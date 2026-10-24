<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Company;
use App\Models\Room;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * How full the rooms are, worked out the same way on the dashboard and in
 * the reports: beds taken, free and out of service, the rent the taken beds
 * bring in each month, and how many people stayed at the end of each month.
 */
trait MeasuresBeds
{
    /**
     * Beds split into occupied, available (free beds in active rooms) and out
     * of service (free beds in rooms under maintenance or inactive).
     *
     * @param  Collection<int, Room>  $rooms
     * @return array{total: int, occupied: int, available: int, outOfService: int, occupancyRate: float|null}
     */
    protected function beds(Collection $rooms): array
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

    protected function availableBeds(Room $room): int
    {
        return $room->status === 'active' ? $room->capacity - $room->occupied_count : 0;
    }

    /**
     * Monthly rent currently billed: occupied beds at their room's bed rate.
     *
     * @param  Collection<int, Room>  $rooms
     */
    protected function rentRoll(Collection $rooms): float
    {
        return (float) $rooms->sum(fn (Room $room) => $room->occupied_count * (float) $room->rent_per_bed);
    }

    /**
     * Monthly rent if every bed in service were let.
     *
     * @param  Collection<int, Room>  $rooms
     */
    protected function potentialRent(Collection $rooms): float
    {
        return (float) $rooms->sum(fn (Room $room) => ($room->occupied_count + $this->availableBeds($room)) * (float) $room->rent_per_bed);
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
