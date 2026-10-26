<?php

namespace App\Http\Controllers;

use App\Models\Apartment;
use App\Models\ContractLine;
use App\Models\Occupancy;
use App\Models\Property;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\Shop;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Who holds each room, shop and apartment of a property: a company under
 * contract, an individual (renting straight from the company or under a
 * contract of their own), or nobody. Units are taken whole; beds are not
 * counted.
 */
class RoomAllocationController extends Controller
{
    /**
     * Unit statuses that take a unit out of service, so an empty one is not
     * available to rent.
     */
    private const OUT_OF_SERVICE = ['inactive', 'under_maintenance'];

    /**
     * Show the property's rooms, shops and apartments with their holders,
     * what each brings in a month, and a summary of each kind.
     */
    public function show(Request $request, Property $property): Response
    {
        $this->ensureSameCompany($request, $property);

        $property->load(['company:id,default_currency', 'propertyType:id,name,slug']);
        $lines = $property->contractLines()
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->with(['contract:id,client_id,contract_number,status', 'contract.client:id,name,client_type'])
            ->get();

        $kinds = [
            'rooms' => $this->roomRows($property, $lines),
            'shops' => $this->shopRows($property, $lines),
            'apartments' => $this->apartmentRows($property, $lines),
        ];

        return Inertia::render('Properties/Allocation', [
            'currency' => $property->company->default_currency,
            'property' => [
                'id' => $property->id,
                'name' => $property->name,
                'code' => $property->code,
                'type' => $property->propertyType?->name,
                'typeSlug' => $property->propertyType?->slug,
                'area' => $property->area,
                'city' => $property->city,
            ],
            ...$kinds,
            'summaries' => array_map(fn (array $rows) => $this->summary($rows), $kinds),
        ]);
    }

    /**
     * Each room with whoever holds it: contract lines for the room (whole,
     * or beds in it), contracts whose property-wide beds have people staying
     * in it, and individuals renting in it.
     *
     * @param  Collection<int, ContractLine>  $lines
     * @return list<array<string, mixed>>
     */
    private function roomRows(Property $property, Collection $lines): array
    {
        $holdings = $lines
            ->whereIn('unit_type', ['bed', 'room'])
            ->whereNotNull('room_id')
            ->map(fn (ContractLine $line) => [$line->room_id, $this->contractHolding($line, $line->quantity)]);

        $propertyWideLines = $lines->where('unit_type', 'bed')->whereNull('room_id')->keyBy('id');

        if ($propertyWideLines->isNotEmpty()) {
            Occupancy::query()
                ->current()
                ->whereIn('contract_line_id', $propertyWideLines->keys())
                ->join('beds', 'beds.id', '=', 'occupancies.bed_id')
                ->groupBy('beds.room_id', 'occupancies.contract_line_id')
                ->selectRaw('beds.room_id, occupancies.contract_line_id, count(*) as people')
                ->toBase()
                ->get()
                ->each(fn (object $stay) => $holdings->push([
                    $stay->room_id,
                    $this->contractHolding($propertyWideLines->get($stay->contract_line_id), (int) $stay->people),
                ]));
        }

        RoomRental::query()
            ->active()
            ->where('property_id', $property->id)
            ->with('client:id,name,client_type')
            ->get()
            ->each(fn (RoomRental $rental) => $holdings->push([$rental->room_id, [
                'category' => 'individual',
                'client' => $rental->client->only(['id', 'name']),
                'reference' => ['kind' => 'rental', 'id' => $rental->id, 'number' => $rental->rental_number, 'status' => $rental->status],
                'startsOn' => $rental->start_date->toDateString(),
                'endsOn' => $rental->end_date?->toDateString(),
                'monthly' => (float) $rental->monthly_rent,
            ]]));

        $byRoom = $holdings->groupBy(0, preserveKeys: false);

        return $this->sortedRows($property->rooms()->with('roomType:id,name,slug')->get()->map(fn (Room $room) => $this->row(
            $room,
            $room->room_number,
            $byRoom->get($room->id, collect())->pluck(1),
            $room->rent_per_bed === null ? null : round((float) $room->rent_per_bed * $room->capacity, 2),
            [
                'type' => $room->roomType ? ['name' => $room->roomType->name, 'slug' => $room->roomType->slug] : null,
                'people' => $room->occupied_count,
            ],
        )));
    }

    /**
     * Each shop with the contracts that rent it.
     *
     * @param  Collection<int, ContractLine>  $lines
     * @return list<array<string, mixed>>
     */
    private function shopRows(Property $property, Collection $lines): array
    {
        $byShop = $lines->where('unit_type', 'shop')->groupBy('shop_id');

        return $this->sortedRows($property->shops()->get()->map(fn (Shop $shop) => $this->row(
            $shop,
            $shop->shop_number,
            $byShop->get($shop->id, collect())->map(fn (ContractLine $line) => $this->contractHolding($line, $line->quantity)),
            $shop->monthly_rent === null ? null : (float) $shop->monthly_rent,
            ['type' => $shop->shop_type],
        )));
    }

    /**
     * Each apartment with the contracts that rent it.
     *
     * @param  Collection<int, ContractLine>  $lines
     * @return list<array<string, mixed>>
     */
    private function apartmentRows(Property $property, Collection $lines): array
    {
        $byApartment = $lines->where('unit_type', 'apartment')->groupBy('apartment_id');

        return $this->sortedRows($property->apartments()->get()->map(fn (Apartment $apartment) => $this->row(
            $apartment,
            $apartment->apartment_number,
            $byApartment->get($apartment->id, collect())->map(fn (ContractLine $line) => $this->contractHolding($line, $line->quantity)),
            $apartment->monthly_rent === null ? null : (float) $apartment->monthly_rent,
            ['bedrooms' => $apartment->bedrooms, 'bathrooms' => $apartment->bathrooms],
        )));
    }

    /**
     * A contract line's hold on a unit, at its rate for `$quantity` of what
     * it rents. A company client's contract counts as a contract; an
     * individual's as an individual.
     *
     * @return array{category: string, client: array{id: int, name: string}, reference: array{kind: string, id: int, number: string, status: string}, startsOn: string, endsOn: string, monthly: float}
     */
    private function contractHolding(ContractLine $line, int $quantity): array
    {
        $contract = $line->contract;

        return [
            'category' => $contract->client->client_type === 'individual' ? 'individual' : 'contract',
            'client' => $contract->client->only(['id', 'name']),
            'reference' => ['kind' => 'contract', 'id' => $contract->id, 'number' => $contract->contract_number, 'status' => $contract->status],
            'startsOn' => $line->start_date->toDateString(),
            'endsOn' => $line->end_date->toDateString(),
            'monthly' => round((float) $line->monthly_rate * $quantity, 2),
        ];
    }

    /**
     * One unit's row. Its holdings are merged per contract or rental and the
     * biggest decides how the unit is allocated.
     *
     * @param  Collection<int, array<string, mixed>>  $holdings
     * @param  array<string, mixed>  $details
     * @return array<string, mixed>
     */
    private function row(Room|Shop|Apartment $unit, string $number, Collection $holdings, ?float $listRent, array $details): array
    {
        $holdings = $holdings
            ->groupBy(fn (array $holding) => $holding['reference']['kind'].':'.$holding['reference']['id'])
            ->map(fn (Collection $same) => [
                ...$same->first(),
                'startsOn' => $same->min('startsOn'),
                'endsOn' => $same->contains('endsOn', null) ? null : $same->max('endsOn'),
                'monthly' => round($same->sum('monthly'), 2),
            ])
            ->sortByDesc('monthly')
            ->values();

        return [
            'id' => $unit->id,
            'number' => $number,
            'block' => $unit->block,
            'floor' => $unit->floor_number,
            'status' => $unit->status,
            'inService' => ! in_array($unit->status, self::OUT_OF_SERVICE, true),
            'allocation' => $holdings->first()['category'] ?? 'empty',
            'holdings' => $holdings->all(),
            'monthly' => round($holdings->sum('monthly'), 2),
            'listRent' => $listRent,
            ...$details,
        ];
    }

    /**
     * Rows in natural number order, so "A-2" comes before "A-10".
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function sortedRows(Collection $rows): array
    {
        return $rows->sortBy('number', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
    }

    /**
     * How many units each kind of holder has, how many are empty (and of
     * those, available to rent), what contracts and individuals pay a month,
     * and the list rent of the available units.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return array{total: int, contract: int, individual: int, empty: int, available: int, clients: array{contract: int, individual: int}, rent: array{contract: float, individual: float, overall: float}, availableListRent: float}
     */
    private function summary(array $rows): array
    {
        $rows = collect($rows);
        $holdings = $rows->pluck('holdings')->flatten(1);
        $available = $rows->where('allocation', 'empty')->where('inService', true);
        $clients = fn (string $category) => $holdings->where('category', $category)->pluck('client.id')->unique()->count();
        $rent = fn (string $category) => round($holdings->where('category', $category)->sum('monthly'), 2);

        return [
            'total' => $rows->count(),
            'contract' => $rows->where('allocation', 'contract')->count(),
            'individual' => $rows->where('allocation', 'individual')->count(),
            'empty' => $rows->where('allocation', 'empty')->count(),
            'available' => $available->count(),
            'clients' => ['contract' => $clients('contract'), 'individual' => $clients('individual')],
            'rent' => [
                'contract' => $rent('contract'),
                'individual' => $rent('individual'),
                'overall' => round($holdings->sum('monthly'), 2),
            ],
            'availableListRent' => round($available->sum('listRent'), 2),
        ];
    }
}
