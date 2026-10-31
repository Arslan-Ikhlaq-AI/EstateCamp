<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Models\Client;
use App\Models\Company;
use App\Models\Room;
use App\Models\RoomRental;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Individuals: the people who rent from the company themselves rather than
 * through an employer, with the rooms they rent short-term now and where
 * their rent stands. Their client page holds the rest.
 */
class IndividualController extends Controller
{
    use ListsRecords;

    /**
     * Whether a person rents rooms now, for the list's filter.
     */
    private const RENTING = ['renting', 'not_renting'];

    /**
     * List the individuals: those renting now first, then by name.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Individuals/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, ['renting' => self::RENTING, 'status' => Client::STATUSES]);
        $everyone = $this->filteredQuery($company, $filters, except: 'renting')->count();
        $renting = $this->filteredQuery($company, $filters, except: 'renting')->whereHas('roomRentals', fn (Builder $rentals) => $rentals->active())->count();

        return Inertia::render('Individuals/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'renting' => $this->facetOptions(self::RENTING, collect(['renting' => $renting, 'not_renting' => $everyone - $renting])),
                'status' => $this->facetOptions(Client::STATUSES, $this->countBy($this->filteredQuery($company, $filters, except: 'status'), 'status')),
            ],
            'summary' => $this->summary($company),
            'individuals' => $this->filteredQuery($company, $filters)
                ->withExists(['roomRentals as is_renting' => fn (Builder $rentals) => $rentals->active()])
                ->withCount(['contracts as active_contracts_count' => fn (Builder $contracts) => $contracts->where('status', 'active')])
                ->with(['roomRentals' => fn (HasMany $rentals) => $rentals
                    ->withSum(['payments as rent_paid' => fn (Builder $payments) => $payments->where('status', 'cleared')->where('purpose', 'rent')], 'amount')
                    ->with([
                        'property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code']),
                        'rooms' => fn ($query) => $query->withTrashed()->select(['rooms.id', 'room_number'])->orderBy('room_number'),
                    ])
                    ->orderByDesc('start_date')])
                ->orderByDesc('is_renting')
                ->orderBy('name')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Client $client) => $this->details($client)),
        ]);
    }

    /**
     * One person as the list shows them: who they are, the rentals they
     * have running, and what they owe across every rental.
     *
     * @return array<string, mixed>
     */
    private function details(Client $client): array
    {
        $running = $client->roomRentals->filter(fn (RoomRental $rental) => $rental->isActive())->values();
        $standings = $client->roomRentals->map(fn (RoomRental $rental) => $rental->rentStanding());

        return [
            'id' => $client->id,
            'name' => $client->name,
            'phone' => $client->phone,
            'email' => $client->email,
            'status' => $client->status,
            'idType' => $client->id_type,
            'idNumber' => $client->id_number,
            'nationality' => $client->nationality,
            'rentals' => $running->map(fn (RoomRental $rental) => [
                'id' => $rental->id,
                'number' => $rental->rental_number,
                'property' => $rental->property?->only(['id', 'name', 'code']),
                'rooms' => $rental->rooms->map(fn (Room $room) => ['id' => $room->id, 'number' => $room->room_number])->all(),
                'endDate' => $rental->end_date?->toDateString(),
                'termOver' => $rental->end_date?->lt(today()) === true,
            ])->all(),
            'pastRentals' => $client->roomRentals->count() - $running->count(),
            'rooms' => $running->sum(fn (RoomRental $rental) => $rental->rooms->count()),
            'monthlyRent' => round($running->sum(fn (RoomRental $rental) => (float) $rental->monthly_rent), 2),
            'owed' => round($standings->sum('arrears'), 2),
            'standing' => $this->worstStanding($standings),
            'activeContracts' => $client->active_contracts_count,
        ];
    }

    /**
     * How a person's rent stands across their rentals: overdue if any is,
     * else due if any is, else paid up. Null when they have never rented.
     *
     * @param  Collection<int, array<string, mixed>>  $standings
     */
    private function worstStanding(Collection $standings): ?string
    {
        if ($standings->isEmpty()) {
            return null;
        }

        return collect(['overdue', 'due'])->first(fn (string $standing) => $standings->contains('standing', $standing)) ?? 'paid_up';
    }

    /**
     * Headline figures: how many individuals there are and how many rent
     * now, the rooms and monthly rent of their running rentals, and the rent
     * they owe.
     *
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $rentals = $company->roomRentals()
            ->whereHas('client', fn (Builder $clients) => $clients->withTrashed()->where('client_type', 'individual'))
            ->withSum(['payments as rent_paid' => fn (Builder $payments) => $payments->where('status', 'cleared')->where('purpose', 'rent')], 'amount')
            ->withCount('rooms')
            ->get();
        $running = $rentals->filter(fn (RoomRental $rental) => $rental->isActive());
        $owing = $rentals->map(fn (RoomRental $rental) => ['client' => $rental->client_id, ...$rental->rentStanding()])->filter(fn (array $standing) => $standing['arrears'] > 0);

        return [
            'individuals' => $company->clients()->where('client_type', 'individual')->count(),
            'renting' => $running->pluck('client_id')->unique()->count(),
            'rooms' => $running->sum('rooms_count'),
            'monthlyRent' => round($running->sum(fn (RoomRental $rental) => (float) $rental->monthly_rent), 2),
            'owed' => [
                'amount' => round($owing->sum('arrears'), 2),
                'count' => $owing->pluck('client')->unique()->count(),
                'overdue' => $owing->where('standing', 'overdue')->pluck('client')->unique()->count(),
            ],
        ];
    }

    /**
     * The company's individuals narrowed by the search and filters, leaving
     * out the filter named in `$except`. The search also finds a person by
     * one of their rental numbers.
     *
     * @param  array<string, mixed>  $filters
     * @return HasMany<Client, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];
        $isRenting = fn (Builder $rentals) => $rentals->active();

        return $company->clients()
            ->where('client_type', 'individual')
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('name', "%{$search}%")
                ->orWhereLike('phone', "%{$search}%")
                ->orWhereLike('email', "%{$search}%")
                ->orWhereLike('id_number', "%{$search}%")
                ->orWhereLike('nationality', "%{$search}%")
                ->orWhereHas('roomRentals', fn (Builder $rentals) => $rentals->whereLike('rental_number', "%{$search}%"))))
            ->when($except !== 'renting' && $filters['renting'] === ['renting'], fn (Builder $query) => $query->whereHas('roomRentals', $isRenting))
            ->when($except !== 'renting' && $filters['renting'] === ['not_renting'], fn (Builder $query) => $query->whereDoesntHave('roomRentals', $isRenting))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']));
    }
}
