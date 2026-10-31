<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Company;
use App\Models\Room;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * How full the rooms are, worked out the same way on the dashboard and in
 * the reports: rooms occupied, vacant and out of service, the rent the
 * occupied rooms bring in each month, and how many people stayed at the
 * end of each month.
 */
trait MeasuresRooms
{
    /**
     * Rooms split into occupied, available (vacant rooms that are active)
     * and out of service (vacant rooms under maintenance or inactive).
     *
     * @param  Collection<int, Room>  $rooms
     * @return array{total: int, occupied: int, available: int, outOfService: int, occupancyRate: float|null}
     */
    protected function roomOccupancy(Collection $rooms): array
    {
        return Room::occupancyBreakdown(
            $rooms->count(),
            $rooms->where('is_occupied', true)->count(),
            $rooms->filter(fn (Room $room) => $this->isAvailable($room))->count(),
        );
    }

    /**
     * Whether the room could be let today: active and vacant.
     */
    protected function isAvailable(Room $room): bool
    {
        return $room->status === 'active' && ! $room->is_occupied;
    }

    /**
     * Monthly rent currently earned: the occupied rooms at their rent.
     *
     * @param  Collection<int, Room>  $rooms
     */
    protected function rentRoll(Collection $rooms): float
    {
        return (float) $rooms->where('is_occupied', true)->sum(fn (Room $room) => (float) $room->monthly_rent);
    }

    /**
     * Monthly rent if every room in service were let.
     *
     * @param  Collection<int, Room>  $rooms
     */
    protected function potentialRent(Collection $rooms): float
    {
        return (float) $rooms
            ->filter(fn (Room $room) => $room->is_occupied || $this->isAvailable($room))
            ->sum(fn (Room $room) => (float) $room->monthly_rent);
    }

    /**
     * People staying at the end of each of `$months` months up to and
     * including `$lastMonth`, from check-in and check-out dates. This
     * month counts today, and months still to come are left at zero.
     *
     * @return list<array{month: string, staying: int}>
     */
    protected function stayingTrend(Company $company, CarbonInterface $lastMonth, int $months): array
    {
        $start = CarbonImmutable::parse($lastMonth)->startOfMonth()->subMonthsNoOverflow($months - 1);

        return collect(range(0, $months - 1))
            ->map(function (int $offset) use ($company, $start) {
                $month = $start->addMonthsNoOverflow($offset);
                $on = $month->isSameMonth(today()) ? today() : $month->endOfMonth()->startOfDay();

                return [
                    'month' => $month->format('Y-m'),
                    'staying' => $month->gt(today()) ? 0 : $company->occupancies()->current($on)->count(),
                ];
            })
            ->all();
    }
}
