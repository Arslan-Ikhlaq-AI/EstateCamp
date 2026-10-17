<?php

namespace App\Http\Middleware;

use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * Documents expiring within this many days raise a notification.
     */
    private const DOCUMENT_WARNING_DAYS = 60;

    /**
     * Leases and the trade license raise a notification this many days ahead.
     */
    private const CONTRACT_WARNING_DAYS = 90;

    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        // Queried rather than loaded as relations, so they never end up inside `auth.user`.
        $company = $user?->company_id ? Company::find($user->company_id) : null;

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user,
                'role' => $user?->role()->value('name'),
                'company' => $company?->only(['id', 'name', 'short_name', 'logo_url']),
            ],
            'notifications' => fn () => $company ? $this->notifications($company) : [],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
            ],
        ];
    }

    /**
     * Things in the company that need attention, most urgent first. Each entry
     * carries data rather than a sentence so the client can word it in the
     * user's language.
     *
     * @return array<int, array{id: string, type: string, severity: string, title: string, subject: string|null, days: int|null, url: string}>
     */
    private function notifications(Company $company): array
    {
        $today = today();

        $documents = PropertyDocument::query()
            ->whereHas('property', fn (Builder $query) => $query->whereBelongsTo($company))
            ->whereNotNull('expires_on')
            ->whereDate('expires_on', '<=', $today->copy()->addDays(self::DOCUMENT_WARNING_DAYS))
            ->with('property:id,name')
            ->get()
            ->map(function (PropertyDocument $document) use ($today): array {
                $days = (int) $today->diffInDays($document->expires_on, false);

                return [
                    'id' => "document-{$document->id}",
                    'type' => $days < 0 ? 'document_expired' : 'document_expiring',
                    'severity' => $days < 0 ? 'critical' : ($days <= 30 ? 'warning' : 'info'),
                    'title' => $document->title,
                    'subject' => $document->property->name,
                    'days' => $days,
                    'url' => route('properties.documents'),
                ];
            });

        $leases = $company->properties()
            ->where('ownership_type', 'leased')
            ->whereNotNull('lease_end_date')
            ->whereDate('lease_end_date', '<=', $today->copy()->addDays(self::CONTRACT_WARNING_DAYS))
            ->get()
            ->map(function (Property $property) use ($today): array {
                $days = (int) $today->diffInDays($property->lease_end_date, false);

                return [
                    'id' => "lease-{$property->id}",
                    'type' => $days < 0 ? 'lease_ended' : 'lease_ending',
                    'severity' => $days < 0 ? 'critical' : 'warning',
                    'title' => $property->name,
                    'subject' => $property->landlord_name,
                    'days' => $days,
                    'url' => route('properties.index'),
                ];
            });

        $rooms = $company->rooms()
            ->where('status', 'under_maintenance')
            ->with('property:id,name')
            ->get()
            ->map(fn (Room $room): array => [
                'id' => "room-{$room->id}",
                'type' => 'room_maintenance',
                'severity' => 'info',
                'title' => $room->room_number,
                'subject' => $room->property->name,
                'days' => null,
                'url' => route('rooms.index', ['status' => ['under_maintenance']]),
            ]);

        $license = collect();

        if ($company->expiry_date?->lte($today->copy()->addDays(self::CONTRACT_WARNING_DAYS))) {
            $days = (int) $today->diffInDays($company->expiry_date, false);

            $license->push([
                'id' => "license-{$company->id}",
                'type' => $days < 0 ? 'license_expired' : 'license_expiring',
                'severity' => $days < 0 ? 'critical' : 'warning',
                'title' => $company->trade_license_number ?? $company->name,
                'subject' => $company->name,
                'days' => $days,
                'url' => route('configuration.company'),
            ]);
        }

        $severityOrder = ['critical' => 0, 'warning' => 1, 'info' => 2];

        return $license
            ->concat($documents)
            ->concat($leases)
            ->concat($rooms)
            ->sortBy([
                fn (array $a, array $b) => $severityOrder[$a['severity']] <=> $severityOrder[$b['severity']],
                fn (array $a, array $b) => ($a['days'] ?? PHP_INT_MAX) <=> ($b['days'] ?? PHP_INT_MAX),
            ])
            ->values()
            ->all();
    }
}
