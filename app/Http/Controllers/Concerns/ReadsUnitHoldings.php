<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Apartment;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Occupancy;
use App\Models\Property;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\Shop;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;

/**
 * Who holds each room, shop and apartment of a property over a period (a
 * client under contract, a company on a short-term rental without a
 * contract, or nobody) and each holder's bill for the period, as the room
 * allocation and the property's payments pages show them. Units are taken
 * whole; beds are not counted.
 */
trait ReadsUnitHoldings
{
    /**
     * Unit statuses that take a unit out of service, so an empty one is not
     * available to rent.
     */
    private const OUT_OF_SERVICE = ['inactive', 'under_maintenance'];

    /**
     * Cheque stages where the company has the cheque but not yet the money.
     */
    private const CHEQUES_IN_HAND = ['received', 'deposited'];

    /**
     * The property's rooms, shops and apartments, each with whoever holds it
     * on any day from `$from` to `$to`, so a contract ending in the period
     * leaves its unit available in the next one.
     *
     * @return array{rooms: list<array<string, mixed>>, shops: list<array<string, mixed>>, apartments: list<array<string, mixed>>}
     */
    protected function unitHoldings(Property $property, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $lines = $property->contractLines()
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from)
            ->whereHas('contract')
            ->with(['contract:id,client_id,contract_number,status,terminated_on', 'contract.client:id,name'])
            ->get()
            ->filter(fn (ContractLine $line) => ($lastDay = $this->lastDay($line)) !== null && $lastDay->gte($from) && $lastDay->gte($line->start_date));

        return [
            'rooms' => $this->roomRows($property, $lines, $from, $to),
            'shops' => $this->shopRows($property, $lines, $to),
            'apartments' => $this->apartmentRows($property, $lines, $to),
        ];
    }

    /**
     * Each company's bill: one account for each contract and short-term
     * rental holding units here in the period (`$kinds`, from unitHoldings()), with those units and its statement
     * for the period, plus earlier ones here that still owe money, so an
     * unpaid balance follows into the next month's bill. A short-term
     * rental is billed as a whole, never room by room; a contract's
     * statement covers the whole contract, also where it rents in other
     * properties.
     *
     * @param  array<string, list<array<string, mixed>>>  $kinds
     * @return list<array<string, mixed>>
     */
    protected function billingAccounts(Property $property, array $kinds, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $units = [];

        foreach ($kinds as $kind => $rows) {
            foreach ($rows as $row) {
                foreach ($row['holdings'] as $holding) {
                    $units[$holding['reference']['kind'].':'.$holding['reference']['id']][] = [
                        ...Arr::only($row, ['id', 'number', 'block', 'floor', 'type', 'bedrooms']),
                        'kind' => $kind,
                        ...Arr::only($holding, ['startsOn', 'endsOn', 'monthly', 'isLatest']),
                    ];
                }
            }
        }

        $heldIds = fn (string $kind) => collect(array_keys($units))
            ->filter(fn (string $key) => str_starts_with($key, "{$kind}:"))
            ->map(fn (string $key) => (int) substr($key, strlen($kind) + 1))
            ->values();
        $inHand = fn (Builder $cheques) => $cheques->whereIn('status', self::CHEQUES_IN_HAND)->whereDate('cheque_date', '<=', $to);

        $contracts = Contract::query()
            ->where('company_id', $property->company_id)
            ->where(fn (Builder $query) => $query
                ->whereKey($heldIds('contract'))
                ->orWhere(fn (Builder $owing) => $owing
                    ->whereIn('status', ['ended', 'terminated'])
                    ->whereHas('lines', fn (Builder $lines) => $lines->where('property_id', $property->id))
                    ->whereHas('invoices', fn (Builder $invoices) => $invoices->whereIn('status', ['issued', 'partially_paid']))))
            ->with([
                'client:id,name',
                'lines',
                'invoices' => fn ($invoices) => $invoices->whereNot('status', 'void'),
                'invoices.allocations.payment:id,payment_number,received_on,method,status',
                'payments' => fn ($payments) => $payments->withSum('allocations as allocated', 'amount'),
            ])
            ->withCount(['cheques as cheques_in_hand_count' => $inHand])
            ->withSum(['cheques as cheques_in_hand_amount' => $inHand], 'amount')
            ->get()
            ->map(fn (Contract $contract) => $this->account($contract, $units["contract:{$contract->id}"] ?? [], $from, $to, [
                'billingCycle' => $contract->billing_cycle,
                'endsOn' => $this->contractLastDay($contract)?->toDateString(),
                'isBilled' => $contract->status !== 'draft',
                'otherProperties' => $contract->lines->pluck('property_id')->unique()->reject(fn ($id) => (int) $id === $property->id)->count(),
            ]));

        $rentals = RoomRental::query()
            ->where('property_id', $property->id)
            ->whereDate('start_date', '<=', $to)
            ->with(['client:id,name', 'payments'])
            ->withCount(['cheques as cheques_in_hand_count' => $inHand])
            ->withSum(['cheques as cheques_in_hand_amount' => $inHand], 'amount')
            ->get()
            ->map(fn (RoomRental $rental) => $this->account($rental, $units["rental:{$rental->id}"] ?? [], $from, $to, [
                'billingCycle' => 'monthly',
                'endsOn' => $rental->lastDay()?->toDateString(),
                'isBilled' => true,
                'otherProperties' => 0,
                'monthly' => round((float) $rental->monthly_rent, 2),
            ]));

        return $contracts->concat($rentals)
            ->filter(fn (array $account) => $account['units'] !== [] || $account['statement']['toPay'] > 0)
            ->sortBy(fn (array $account) => mb_strtolower($account['client']['name']).' '.$account['number'], SORT_NATURAL)
            ->values()
            ->all();
    }

    /**
     * One account on the billing tab: who it bills, the units it holds here
     * in the period and its rent a month for them, the cheques the company
     * holds towards it, its statement for the period, and the most it can
     * be paid today (up to the end of the agreement; null for no end).
     *
     * @param  list<array<string, mixed>>  $units
     * @param  array<string, mixed>  $details
     * @return array<string, mixed>
     */
    private function account(Contract|RoomRental $agreement, array $units, CarbonImmutable $from, CarbonImmutable $to, array $details): array
    {
        $isContract = $agreement instanceof Contract;

        return [
            'key' => ($isContract ? 'contract' : 'rental').':'.$agreement->id,
            'kind' => $isContract ? 'contract' : 'rental',
            'id' => $agreement->id,
            'number' => $isContract ? $agreement->contract_number : $agreement->rental_number,
            'status' => $agreement->status,
            'client' => $agreement->client->only(['id', 'name']),
            'startsOn' => $agreement->start_date->toDateString(),
            'units' => $units,
            'monthly' => round(collect($units)->where('isLatest', true)->sum('monthly'), 2),
            'chequesInHand' => ['count' => (int) $agreement->cheques_in_hand_count, 'amount' => round((float) $agreement->cheques_in_hand_amount, 2)],
            'statement' => $agreement->billingStatement($from, $to),
            'collectionLimit' => $agreement->collectionLimit(),
            ...$details,
        ];
    }

    /**
     * The last day a contract runs: its end date, or the day before it was
     * terminated. Null for a contract marked terminated without a date.
     */
    private function contractLastDay(Contract $contract): ?CarbonImmutable
    {
        if ($contract->status !== 'terminated') {
            return $contract->end_date->toImmutable();
        }

        return $contract->terminated_on?->toImmutable()->subDay();
    }

    /**
     * The last day a contract line holds its unit: its end date, or the day
     * before its contract was terminated if that came first. Null for a
     * contract marked terminated without a date.
     */
    private function lastDay(ContractLine $line): ?CarbonImmutable
    {
        $contract = $line->contract;

        if ($contract->status !== 'terminated') {
            return $line->end_date->toImmutable();
        }

        if ($contract->terminated_on === null) {
            return null;
        }

        $dayBefore = $contract->terminated_on->toImmutable()->subDay();

        return $dayBefore->lt($line->end_date) ? $dayBefore : $line->end_date->toImmutable();
    }

    /**
     * Each room with whoever holds it in the period: contract lines for the
     * room (whole, or beds in it), contracts whose property-wide beds had
     * people staying in it, and short-term rentals holding it. A rental's
     * monthly rent is shared equally between its rooms.
     *
     * @param  Collection<int, ContractLine>  $lines
     * @return list<array<string, mixed>>
     */
    private function roomRows(Property $property, Collection $lines, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $holdings = $lines
            ->whereIn('unit_type', ['bed', 'room'])
            ->whereNotNull('room_id')
            ->map(fn (ContractLine $line) => [$line->room_id, $this->contractHolding($line, $line->quantity)])
            ->values();

        $propertyWideLines = $lines->where('unit_type', 'bed')->whereNull('room_id')->keyBy('id');

        if ($propertyWideLines->isNotEmpty()) {
            Occupancy::query()
                ->whereIn('contract_line_id', $propertyWideLines->keys())
                ->whereDate('check_in_date', '<=', $to)
                ->where(fn (Builder $stays) => $stays->whereNull('check_out_date')->orWhereDate('check_out_date', '>', $from))
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
            ->where('property_id', $property->id)
            ->whereDate('start_date', '<=', $to)
            ->with(['client:id,name', 'rooms:rooms.id'])
            ->get()
            ->reject(fn (RoomRental $rental) => $rental->lastDay()?->lt($from) ?? false)
            ->each(fn (RoomRental $rental) => $rental->rooms->each(fn (Room $room) => $holdings->push([$room->id, [
                'category' => 'short_term',
                'client' => $rental->client->only(['id', 'name']),
                'reference' => ['kind' => 'rental', 'id' => $rental->id, 'number' => $rental->rental_number, 'status' => $rental->status],
                'startsOn' => $rental->start_date->toDateString(),
                'endsOn' => $rental->lastDay()?->toDateString(),
                'monthly' => round((float) $rental->monthly_rent / max(1, $rental->rooms->count()), 2),
            ]])));

        $byRoom = $holdings->groupBy(0, preserveKeys: false);

        $rooms = $property->rooms()
            ->with('roomType:id,name,slug')
            ->withCount(['occupancies as people_staying' => fn (Builder $stays) => $stays->current()])
            ->get();

        return $this->sortedRows($rooms->map(fn (Room $room) => $this->row(
            $room,
            $room->room_number,
            $byRoom->get($room->id, collect())->pluck(1),
            $room->rent_per_bed === null ? null : round((float) $room->rent_per_bed * $room->capacity, 2),
            $to,
            [
                'type' => $room->roomType ? ['name' => $room->roomType->name, 'slug' => $room->roomType->slug] : null,
                'people' => $room->people_staying,
            ],
        )));
    }

    /**
     * Each shop with the contracts that rent it in the period.
     *
     * @param  Collection<int, ContractLine>  $lines
     * @return list<array<string, mixed>>
     */
    private function shopRows(Property $property, Collection $lines, CarbonImmutable $to): array
    {
        $byShop = $lines->where('unit_type', 'shop')->groupBy('shop_id');

        return $this->sortedRows($property->shops()->get()->map(fn (Shop $shop) => $this->row(
            $shop,
            $shop->shop_number,
            $byShop->get($shop->id, collect())->map(fn (ContractLine $line) => $this->contractHolding($line, $line->quantity)),
            $shop->monthly_rent === null ? null : (float) $shop->monthly_rent,
            $to,
            ['type' => $shop->shop_type],
        )));
    }

    /**
     * Each apartment with the contracts that rent it in the period.
     *
     * @param  Collection<int, ContractLine>  $lines
     * @return list<array<string, mixed>>
     */
    private function apartmentRows(Property $property, Collection $lines, CarbonImmutable $to): array
    {
        $byApartment = $lines->where('unit_type', 'apartment')->groupBy('apartment_id');

        return $this->sortedRows($property->apartments()->get()->map(fn (Apartment $apartment) => $this->row(
            $apartment,
            $apartment->apartment_number,
            $byApartment->get($apartment->id, collect())->map(fn (ContractLine $line) => $this->contractHolding($line, $line->quantity)),
            $apartment->monthly_rent === null ? null : (float) $apartment->monthly_rent,
            $to,
            ['bedrooms' => $apartment->bedrooms, 'bathrooms' => $apartment->bathrooms],
        )));
    }

    /**
     * A contract line's hold on a unit, at its rate for `$quantity` of what
     * it rents, until its last day.
     *
     * @return array{category: string, client: array{id: int, name: string}, reference: array{kind: string, id: int, number: string, status: string}, startsOn: string, endsOn: string, monthly: float}
     */
    private function contractHolding(ContractLine $line, int $quantity): array
    {
        $contract = $line->contract;

        return [
            'category' => 'contract',
            'client' => $contract->client->only(['id', 'name']),
            'reference' => ['kind' => 'contract', 'id' => $contract->id, 'number' => $contract->contract_number, 'status' => $contract->status],
            'startsOn' => $line->start_date->toDateString(),
            'endsOn' => $this->lastDay($line)->toDateString(),
            'monthly' => round((float) $line->monthly_rate * $quantity, 2),
        ];
    }

    /**
     * One unit's row. Its holdings are merged per contract or rental; those
     * still running on the last day the unit is held in the period are the
     * latest (`isLatest`), so a tenant who replaced another is not counted
     * twice. The latest holdings set the monthly rent, and the biggest of
     * them decides how the unit is allocated. `standardRent` is the rent the
     * unit was set up with; `freeFrom` is the day it comes free when every
     * holding ends before `$periodEnd`.
     *
     * @param  Collection<int, array<string, mixed>>  $holdings
     * @param  array<string, mixed>  $details
     * @return array<string, mixed>
     */
    private function row(Room|Shop|Apartment $unit, string $number, Collection $holdings, ?float $standardRent, CarbonImmutable $periodEnd, array $details): array
    {
        $holdings = $holdings
            ->groupBy(fn (array $holding) => $holding['reference']['kind'].':'.$holding['reference']['id'])
            ->map(fn (Collection $same) => [
                ...$same->first(),
                'startsOn' => $same->min('startsOn'),
                'endsOn' => $same->contains('endsOn', null) ? null : $same->max('endsOn'),
                'monthly' => round($same->sum('monthly'), 2),
            ])
            ->values();
        $lastDay = $holdings->isEmpty() || $holdings->contains('endsOn', null) ? null : $holdings->max('endsOn');
        $latestDay = min($lastDay ?? $periodEnd->toDateString(), $periodEnd->toDateString());
        $holdings = $holdings
            ->map(fn (array $holding) => [...$holding, 'isLatest' => $holding['startsOn'] <= $latestDay && ($holding['endsOn'] ?? $latestDay) >= $latestDay])
            ->sortBy([['isLatest', 'desc'], ['monthly', 'desc'], ['startsOn', 'desc']])
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
            'monthly' => round($holdings->where('isLatest', true)->sum('monthly'), 2),
            'standardRent' => $standardRent,
            'freeFrom' => $lastDay !== null && $lastDay < $periodEnd->toDateString() ? CarbonImmutable::parse($lastDay)->addDay()->toDateString() : null,
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
}
