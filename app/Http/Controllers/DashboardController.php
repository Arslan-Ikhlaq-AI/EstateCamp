<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Documents expiring within this many days count as "expiring soon".
     */
    public const EXPIRY_WARNING_DAYS = 60;

    /**
     * Show the operations overview for the signed-in user's company.
     */
    public function __invoke(Request $request): Response
    {
        // Queried directly so the company is not cached on the shared `auth.user` prop.
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Dashboard', ['company' => null]);
        }

        $properties = $company->properties()
            ->with('propertyType:id,name,slug')
            ->orderBy('name')
            ->get();

        $rooms = $company->rooms()
            ->with([
                'property:id,name,code',
                'roomType:id,name,slug',
                'attachments' => fn ($query) => $query->where('is_primary', true),
            ])
            ->orderBy('property_id')
            ->orderBy('room_number')
            ->get();

        $documents = PropertyDocument::query()
            ->whereIn('property_id', $properties->modelKeys())
            ->with('property:id,name')
            ->get()
            ->sortBy(fn (PropertyDocument $document) => $document->expires_on?->timestamp ?? PHP_INT_MAX)
            ->values();

        return Inertia::render('Dashboard', [
            'company' => $this->companyDetails($company),
            'summary' => [
                'properties' => $properties->count(),
                'rooms' => $rooms->count(),
                'roomsUnderMaintenance' => $rooms->where('status', 'under_maintenance')->count(),
                'beds' => $this->beds($rooms),
                'rentRoll' => $this->rentRoll($rooms),
                'potentialRent' => $this->potentialRent($rooms),
                'documents' => [
                    'total' => $documents->count(),
                    'expiring' => $documents->filter(fn (PropertyDocument $document) => $this->documentStatus($document) === 'expiring')->count(),
                    'expired' => $documents->filter(fn (PropertyDocument $document) => $this->documentStatus($document) === 'expired')->count(),
                ],
            ],
            'properties' => $properties->map(fn (Property $property) => $this->propertyDetails(
                $property,
                $rooms->where('property_id', $property->id),
            )),
            'roomTypes' => $rooms
                ->groupBy('room_type_id')
                ->map(fn (Collection $typeRooms) => [
                    'slug' => $typeRooms->first()->roomType->slug,
                    'name' => $typeRooms->first()->roomType->name,
                    'rooms' => $typeRooms->count(),
                    'beds' => $this->beds($typeRooms),
                ])
                ->sortByDesc('beds.total')
                ->values(),
            'rooms' => $rooms->map(fn (Room $room) => $this->roomDetails($room)),
            'documents' => $documents->map(fn (PropertyDocument $document) => $this->documentDetails($document)),
            'team' => $company->users()
                ->with('role:id,name')
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role?->name,
                ]),
        ]);
    }

    /**
     * Beds split into occupied, available (free beds in active rooms) and out
     * of service (free beds in rooms under maintenance or inactive).
     *
     * @param  Collection<int, Room>  $rooms
     * @return array{total: int, occupied: int, available: int, outOfService: int, occupancyRate: float|null}
     */
    private function beds(Collection $rooms): array
    {
        $total = (int) $rooms->sum('capacity');
        $occupied = (int) $rooms->sum('occupied_count');
        $available = (int) $rooms->sum(fn (Room $room) => $this->availableBeds($room));
        $inService = $occupied + $available;

        return [
            'total' => $total,
            'occupied' => $occupied,
            'available' => $available,
            'outOfService' => $total - $inService,
            'occupancyRate' => $inService > 0 ? round($occupied / $inService * 100, 1) : null,
        ];
    }

    private function availableBeds(Room $room): int
    {
        return $room->status === 'active' ? $room->capacity - $room->occupied_count : 0;
    }

    /**
     * Monthly rent currently billed: occupied beds at their room's bed rate.
     *
     * @param  Collection<int, Room>  $rooms
     */
    private function rentRoll(Collection $rooms): float
    {
        return (float) $rooms->sum(fn (Room $room) => $room->occupied_count * (float) $room->rent_per_bed);
    }

    /**
     * Monthly rent if every bed in service were let.
     *
     * @param  Collection<int, Room>  $rooms
     */
    private function potentialRent(Collection $rooms): float
    {
        return (float) $rooms->sum(fn (Room $room) => ($room->occupied_count + $this->availableBeds($room)) * (float) $room->rent_per_bed);
    }

    private function documentStatus(PropertyDocument $document): string
    {
        return match (true) {
            $document->expires_on === null => 'no_expiry',
            $document->expires_on->isBefore(today()) => 'expired',
            $document->expires_on->lte(today()->addDays(self::EXPIRY_WARNING_DAYS)) => 'expiring',
            default => 'valid',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function companyDetails(Company $company): array
    {
        return [
            'name' => $company->name,
            'legalName' => $company->legal_name,
            'shortName' => $company->short_name,
            'logoUrl' => $company->logo_url,
            'tradeLicenseNumber' => $company->trade_license_number,
            'taxRegistrationNumber' => $company->tax_registration_number,
            'licenseExpiresOn' => $company->expiry_date?->toDateString(),
            'currency' => $company->default_currency,
            'timezone' => $company->timezone,
            'city' => $company->city,
            'countryCode' => $company->country_code,
            'email' => $company->email,
            'phone' => $company->phone,
        ];
    }

    /**
     * @param  Collection<int, Room>  $rooms
     * @return array<string, mixed>
     */
    private function propertyDetails(Property $property, Collection $rooms): array
    {
        return [
            'id' => $property->id,
            'name' => $property->name,
            'code' => $property->code,
            'type' => $property->propertyType?->name,
            'typeSlug' => $property->propertyType?->slug,
            'area' => $property->area,
            'city' => $property->city,
            'coverImageUrl' => $property->cover_image_url,
            'status' => $property->status,
            'ownership' => $property->ownership_type,
            'leaseEndsOn' => $property->lease_end_date?->toDateString(),
            'rooms' => $rooms->count(),
            'beds' => $this->beds($rooms),
            'rentRoll' => $this->rentRoll($rooms),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function roomDetails(Room $room): array
    {
        $photo = $room->attachments->first();

        return [
            'id' => $room->id,
            'number' => $room->room_number,
            'block' => $room->block,
            'floor' => $room->floor_number,
            'property' => $room->property->name,
            'propertyCode' => $room->property->code,
            'type' => $room->roomType->name,
            'typeSlug' => $room->roomType->slug,
            'genderPolicy' => $room->gender_policy,
            'capacity' => $room->capacity,
            'occupied' => $room->occupied_count,
            'rentPerBed' => $room->rent_per_bed === null ? null : (float) $room->rent_per_bed,
            'status' => $room->status,
            'photoUrl' => $photo?->thumbnail_url ?? $photo?->file_url,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function documentDetails(PropertyDocument $document): array
    {
        return [
            'id' => $document->id,
            'type' => $document->document_type,
            'title' => $document->title,
            'number' => $document->document_number,
            'property' => $document->property->name,
            'expiresOn' => $document->expires_on?->toDateString(),
            'daysLeft' => $document->expires_on === null ? null : (int) today()->diffInDays($document->expires_on, false),
            'status' => $this->documentStatus($document),
        ];
    }
}
