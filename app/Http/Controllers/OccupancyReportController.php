<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\MeasuresBeds;
use App\Http\Controllers\Concerns\PreparesReports;
use App\Models\Company;
use App\Models\Occupancy;
use App\Models\Property;
use App\Models\Room;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The occupancy report: how full each property and kind of room is today,
 * the rent the taken beds bring in against what a full house would, who
 * is staying (by client, nationality and gender), who moved in and out
 * over a period, a year of people staying, and the rooms with beds free.
 */
class OccupancyReportController extends Controller
{
    use FiltersByPeriod, MeasuresBeds, PreparesReports;

    /**
     * Months in the trend, ending with the period's last month.
     */
    private const TREND_MONTHS = 12;

    /**
     * How many nationalities the report names before grouping the rest.
     */
    private const TOP_NATIONALITIES = 8;

    public function __invoke(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Reports/Occupancy', ['company' => null]);
        }

        $period = $this->periodFilter($request, 'this_month');
        $rooms = $company->rooms()
            ->with(['property:id,name,code', 'roomType:id,name,slug'])
            ->orderBy('property_id')
            ->orderBy('room_number')
            ->get();
        $staying = $company->occupancies()
            ->current()
            ->with(['occupant:id,client_id,gender,nationality', 'occupant.client:id,name,client_type'])
            ->get();

        return Inertia::render('Reports/Occupancy', [
            'company' => $this->reportCompany($company),
            'prepared' => $this->preparedBy($company, $request),
            'period' => $period,
            'summary' => [
                'properties' => $company->properties()->count(),
                'rooms' => $rooms->count(),
                'beds' => $this->beds($rooms),
                'staying' => $staying->count(),
                'rentRoll' => $this->rentRoll($rooms),
                'potentialRent' => $this->potentialRent($rooms),
                'checkIns' => $this->wherePeriod($company->occupancies(), 'check_in_date', $period)->count(),
                'checkOuts' => $this->wherePeriod($company->occupancies()->whereNotNull('check_out_date'), 'check_out_date', $period)->count(),
            ],
            'properties' => $company->properties()
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'status'])
                ->map(fn (Property $property) => $this->unitDetails($rooms->where('property_id', $property->id), [
                    'id' => $property->id,
                    'name' => $property->name,
                    'code' => $property->code,
                    'status' => $property->status,
                ]))
                ->all(),
            'roomTypes' => $rooms
                ->groupBy('room_type_id')
                ->map(fn (Collection $typeRooms) => $this->unitDetails($typeRooms, [
                    'slug' => $typeRooms->first()->roomType->slug,
                    'name' => $typeRooms->first()->roomType->name,
                ]))
                ->sortByDesc('beds.total')
                ->values()
                ->all(),
            'clients' => $staying
                ->groupBy('occupant.client_id')
                ->map(fn (Collection $stays) => [
                    'id' => $stays->first()->occupant->client->id,
                    'name' => $stays->first()->occupant->client->name,
                    'type' => $stays->first()->occupant->client->client_type,
                    'staying' => $stays->count(),
                    'male' => $stays->where('occupant.gender', 'male')->count(),
                    'female' => $stays->where('occupant.gender', 'female')->count(),
                ])
                ->sortBy([['staying', 'desc'], ['name', 'asc']])
                ->values()
                ->all(),
            'nationalities' => $this->nationalities($staying),
            'gender' => [
                'male' => $staying->where('occupant.gender', 'male')->count(),
                'female' => $staying->where('occupant.gender', 'female')->count(),
            ],
            'trend' => $this->stayingTrend($company, CarbonImmutable::parse($period['to'] ?? today()), self::TREND_MONTHS),
            'vacancies' => $rooms
                ->filter(fn (Room $room) => $this->availableBeds($room) > 0)
                ->map(fn (Room $room) => [
                    'id' => $room->id,
                    'property' => $room->property->name,
                    'propertyCode' => $room->property->code,
                    'number' => $room->room_number,
                    'type' => $room->roomType->name,
                    'genderPolicy' => $room->gender_policy,
                    'capacity' => $room->capacity,
                    'occupied' => $room->occupied_count,
                    'free' => $this->availableBeds($room),
                    'rentPerBed' => $room->rent_per_bed === null ? null : (float) $room->rent_per_bed,
                ])
                ->values()
                ->all(),
        ]);
    }

    /**
     * A group of rooms (a property's, or one kind's) with its beds and rent.
     *
     * @param  Collection<int, Room>  $rooms
     * @param  array<string, mixed>  $details
     * @return array<string, mixed>
     */
    private function unitDetails(Collection $rooms, array $details): array
    {
        return [
            ...$details,
            'rooms' => $rooms->count(),
            'beds' => $this->beds($rooms),
            'rentRoll' => $this->rentRoll($rooms),
            'potentialRent' => $this->potentialRent($rooms),
        ];
    }

    /**
     * The nationalities of the people staying, most first. Past the first
     * few the rest are grouped as `other`, and those with none recorded as
     * `unknown`.
     *
     * @param  Collection<int, Occupancy>  $staying
     * @return list<array{nationality: ?string, group: string, count: int}>
     */
    private function nationalities(Collection $staying): array
    {
        $counts = $staying
            ->countBy(fn (Occupancy $stay) => $stay->occupant->nationality ?? '')
            ->sortDesc();
        $named = $counts->except('')->take(self::TOP_NATIONALITIES);
        $other = $counts->except(['', ...$named->keys()->all()])->sum();

        return $named
            ->map(fn (int $count, string $nationality) => ['nationality' => $nationality, 'group' => 'named', 'count' => $count])
            ->values()
            ->when($other > 0, fn (Collection $rows) => $rows->push(['nationality' => null, 'group' => 'other', 'count' => $other]))
            ->when($counts->has(''), fn (Collection $rows) => $rows->push(['nationality' => null, 'group' => 'unknown', 'count' => $counts['']]))
            ->all();
    }
}
