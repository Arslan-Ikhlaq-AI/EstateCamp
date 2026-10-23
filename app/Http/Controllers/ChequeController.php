<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\ChequeDetailsRequest;
use App\Http\Requests\ChequeReplaceRequest;
use App\Http\Requests\ChequeTransitionRequest;
use App\Models\Cheque;
use App\Models\Company;
use App\Models\Contract;
use App\Models\HeadLease;
use App\Models\RoomRental;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The cheque register: every cheque the company receives from clients and
 * individual tenants or issues to landlords, and what happens to each one.
 */
class ChequeController extends Controller
{
    use FiltersByPeriod, ListsRecords;

    public const DUE_FILTERS = ['overdue', 'this_week', 'next_30_days', 'to_collect'];

    /**
     * List the cheques: those still to deal with first, soonest dated on top.
     * A period narrows them to those dated in it; `party` to the cheques of
     * chosen clients, tenants or landlords (`client:12`, `landlord:3`).
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Cheques/Index', ['company' => null]);
        }

        $period = $this->periodFilter($request);
        $filters = [
            ...$this->listFilters($request, [
                'direction' => Cheque::DIRECTIONS,
                'status' => Cheque::STATUSES,
                'due' => self::DUE_FILTERS,
                'purpose' => Cheque::PURPOSES,
                'party' => null,
            ]),
            'period' => $period['value'],
        ];
        $filters['party'] = array_values(array_filter($filters['party'], fn (string $party) => preg_match('/^(client|landlord):\d+$/', $party) === 1));
        $statuses = count($filters['direction']) === 1 ? Cheque::DIRECTION_STATUSES[$filters['direction'][0]] : Cheque::STATUSES;
        $dueQuery = fn () => $this->filteredQuery($company, $filters, $period, except: 'due');

        return Inertia::render('Cheques/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'status' => $this->facetOptions($statuses, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'status'), 'status')),
                'due' => array_map(fn (string $due) => ['value' => $due, 'count' => $this->whereDue($dueQuery(), $due)->count()], self::DUE_FILTERS),
                'purpose' => $this->facetOptions(Cheque::PURPOSES, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'purpose'), 'purpose')),
                'party' => $this->partyFacet($company, $filters, $period),
            ],
            'summary' => self::summary($company),
            'periodTotals' => $period['kind'] === 'all' ? null : $this->periodTotals($this->filteredQuery($company, $filters, $period)),
            'cheques' => $this->filteredQuery($company, $filters, $period)
                ->with(self::detailRelations())
                ->orderByRaw("case when status in ('pending', 'received', 'issued', 'deposited') then 0 else 1 end")
                ->orderBy('cheque_date')
                ->orderBy('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Cheque $cheque) => self::details($cheque)),
        ]);
    }

    /**
     * Record a cheque's details and photos before it goes to the bank.
     */
    public function update(ChequeDetailsRequest $request, Cheque $cheque): RedirectResponse
    {
        $cheque->fill(['notes' => $request->validated('notes')]);
        $cheque->applyEntry($request->entry(), $request->user());

        return back()->with('success', "Cheque {$this->label($cheque)} was saved.");
    }

    /**
     * Record what happened to a cheque: deposited, cleared, bounced, handed back or cancelled.
     */
    public function transition(ChequeTransitionRequest $request, Cheque $cheque): RedirectResponse
    {
        $on = $request->date('date') ?? today();

        match ($request->validated('action')) {
            'deposit' => $cheque->deposit($on),
            'clear' => $cheque->clear($on),
            'bounce' => $cheque->bounce($on, $request->validated('reason')),
            'return' => $cheque->markReturned($on, $request->validated('note')),
            'cancel' => $cheque->cancel($request->validated('note')),
        };

        $message = match ($request->validated('action')) {
            'deposit' => "Cheque {$this->label($cheque)} was deposited.",
            'clear' => match (true) {
                $cheque->direction === 'received' && $cheque->payment !== null => "Cheque {$this->label($cheque)} cleared and was recorded as payment {$cheque->payment->payment_number}.",
                $cheque->direction === 'received' && $cheque->rentalPayment !== null => "Cheque {$this->label($cheque)} cleared and was recorded as receipt {$cheque->rentalPayment->receipt_number}.",
                default => "Cheque {$this->label($cheque)} cleared.",
            },
            'bounce' => "Cheque {$this->label($cheque)} was marked as bounced. Record the replacement cheque when it arrives.",
            'return' => "Cheque {$this->label($cheque)} was handed back.",
            'cancel' => "Cheque {$this->label($cheque)} was cancelled.",
        };

        return back()->with('success', $message);
    }

    /**
     * Record the new cheque standing in for a bounced one.
     */
    public function replace(ChequeReplaceRequest $request, Cheque $cheque): RedirectResponse
    {
        $replacement = $cheque->replaceWith($request->entry(), $request->user());

        return back()->with('success', "Replacement cheque {$this->label($replacement)} was recorded for the bounced cheque {$this->label($cheque)}.");
    }

    /**
     * A photo of one side of a cheque, for the company's own users only.
     */
    public function image(Request $request, Cheque $cheque, string $side): StreamedResponse
    {
        $this->ensureSameCompany($request, $cheque);

        $path = $cheque->{"{$side}_image_path"};

        abort_unless($path && Storage::disk(Cheque::IMAGE_DISK)->exists($path), 404);

        return Storage::disk(Cheque::IMAGE_DISK)->response($path, null, ['Cache-Control' => 'private, max-age=3600']);
    }

    /**
     * Build the cheque schedule of a contract that has none yet.
     */
    public function scheduleContract(Request $request, Contract $contract): RedirectResponse
    {
        $this->ensureSameCompany($request, $contract);

        if (! $contract->isEditable()) {
            throw ValidationException::withMessages(['action' => 'An ended or terminated contract can no longer change its cheques.']);
        }

        $contract->syncCheques([], $request->user());

        return back()->with('success', "The cheque schedule of {$contract->contract_number} was set up. Record each cheque as you receive it.");
    }

    /**
     * Build the cheque schedule of a head lease that has none yet.
     */
    public function scheduleLease(Request $request, HeadLease $headLease): RedirectResponse
    {
        $this->ensureSameCompany($request, $headLease);

        $headLease->syncCheques([], $request->user());

        return back()->with('success', "The cheque schedule of {$headLease->lease_number} was set up. Record each cheque as you write it.");
    }

    /**
     * The relations details() reads, for eager loading.
     *
     * @return array<string, mixed>
     */
    public static function detailRelations(): array
    {
        return [
            'chequeable' => fn (MorphTo $morph) => $morph->morphWith([
                Contract::class => ['client:id,name'],
                HeadLease::class => ['landlord:id,name', 'property:id,name,code'],
                RoomRental::class => ['client:id,name', 'property:id,name,code'],
            ]),
            'replacement:id,replaces_id',
            'payment:id,cheque_id,payment_number',
            'rentalPayment:id,cheque_id,receipt_number,status',
        ];
    }

    /**
     * One cheque as the pages show it, with who it is from or to and what can happen to it next.
     *
     * @return array<string, mixed>
     */
    public static function details(Cheque $cheque): array
    {
        $agreement = $cheque->chequeable;
        $version = $cheque->updated_at?->timestamp;
        $receipt = match (true) {
            $cheque->payment !== null => ['id' => $cheque->payment->id, 'payment_number' => $cheque->payment->payment_number, 'url' => route('payments.show', $cheque->payment->id)],
            $cheque->rentalPayment !== null => ['id' => $cheque->rentalPayment->id, 'payment_number' => $cheque->rentalPayment->receipt_number, 'url' => route('rental-payments.show', $cheque->rentalPayment->id)],
            default => null,
        };

        return [
            'id' => $cheque->id,
            'direction' => $cheque->direction,
            'purpose' => $cheque->purpose,
            'sequence' => $cheque->sequence,
            'periodStart' => $cheque->period_start?->toDateString(),
            'periodEnd' => $cheque->period_end?->toDateString(),
            'chequeDate' => $cheque->cheque_date->toDateString(),
            'amount' => (float) $cheque->amount,
            'chequeNumber' => $cheque->cheque_number,
            'bankName' => $cheque->bank_name,
            'accountHolder' => $cheque->account_holder,
            'status' => $cheque->status,
            'isOverdue' => $cheque->isOverdue(),
            'isDueNow' => $cheque->isDueNow(),
            'handedOverOn' => $cheque->handed_over_on?->toDateString(),
            'depositedOn' => $cheque->deposited_on?->toDateString(),
            'clearedOn' => $cheque->cleared_on?->toDateString(),
            'bouncedOn' => $cheque->bounced_on?->toDateString(),
            'bounceReason' => $cheque->bounce_reason,
            'notes' => $cheque->notes,
            'frontImageUrl' => $cheque->front_image_path ? route('cheques.image', [$cheque, 'front', 'v' => $version]) : null,
            'backImageUrl' => $cheque->back_image_path ? route('cheques.image', [$cheque, 'back', 'v' => $version]) : null,
            'actions' => $cheque->allowedActions(),
            'canEdit' => $cheque->isEditable(),
            'canReplace' => $cheque->status === 'bounced' && $cheque->replacement === null,
            'replacesId' => $cheque->replaces_id,
            'replacementId' => $cheque->replacement?->id,
            'payment' => $receipt,
            'agreement' => match (true) {
                $agreement instanceof Contract => ['type' => 'contract', 'id' => $agreement->id, 'number' => $agreement->contract_number],
                $agreement instanceof HeadLease => ['type' => 'head_lease', 'id' => $agreement->id, 'number' => $agreement->lease_number],
                $agreement instanceof RoomRental => ['type' => 'room_rental', 'id' => $agreement->id, 'number' => $agreement->rental_number],
                default => null,
            },
            'party' => match (true) {
                $agreement instanceof Contract, $agreement instanceof RoomRental => ['type' => 'client', 'id' => $agreement->client_id, 'name' => $agreement->client?->name],
                $agreement instanceof HeadLease => ['type' => 'landlord', 'id' => $agreement->landlord_id, 'name' => $agreement->landlord?->name],
                default => null,
            },
            'property' => $agreement instanceof HeadLease || $agreement instanceof RoomRental ? $agreement->property?->only(['id', 'name', 'code']) : null,
        ];
    }

    /**
     * A stored cheque as the lease and contract forms prefill it.
     *
     * @return array<string, mixed>
     */
    public static function formDetails(Cheque $cheque): array
    {
        return [
            'id' => $cheque->id,
            'key' => $cheque->scheduleKey(),
            'purpose' => $cheque->purpose,
            'sequence' => $cheque->sequence,
            'period_start' => $cheque->period_start?->toDateString(),
            'period_end' => $cheque->period_end?->toDateString(),
            'status' => $cheque->status,
            'locked' => ! $cheque->isEditable(),
            'cheque_date' => $cheque->cheque_date->toDateString(),
            'amount' => (float) $cheque->amount,
            'cheque_number' => $cheque->cheque_number,
            'bank_name' => $cheque->bank_name,
            'account_holder' => $cheque->account_holder,
            'front_image_url' => $cheque->front_image_path ? route('cheques.image', [$cheque, 'front', 'v' => $cheque->updated_at?->timestamp]) : null,
            'back_image_url' => $cheque->back_image_path ? route('cheques.image', [$cheque, 'back', 'v' => $cheque->updated_at?->timestamp]) : null,
        ];
    }

    /**
     * Banks the company's cheques have been drawn on, offered as suggestions.
     *
     * @return list<string>
     */
    public static function knownBanks(Company $company): array
    {
        return $company->cheques()->whereNotNull('bank_name')->distinct()->orderBy('bank_name')->limit(50)->pluck('bank_name')->all();
    }

    /**
     * Headline figures across every cheque: what to bank, what is in hand,
     * what goes out soon and what bounced.
     *
     * @return array<string, array{count: int, amount: float}>
     */
    public static function summary(Company $company): array
    {
        $totals = fn (Builder|HasMany $query) => ['count' => (clone $query)->count(), 'amount' => round((float) (clone $query)->sum('amount'), 2)];
        $today = today();

        return [
            'toDeposit' => $totals($company->cheques()->where('direction', 'received')->where('status', 'received')->whereDate('cheque_date', '<=', $today)),
            'inHand' => $totals($company->cheques()->where('direction', 'received')->where('status', 'received')->whereDate('cheque_date', '>', $today)),
            'atBank' => $totals($company->cheques()->where('direction', 'received')->where('status', 'deposited')),
            'toCollect' => $totals($company->cheques()->where('direction', 'received')->where('status', 'pending')->whereDate('cheque_date', '<=', $today->copy()->addDays(30))),
            'dueToPay' => $totals($company->cheques()->where('direction', 'issued')->whereIn('status', ['pending', 'issued'])->whereDate('cheque_date', '<=', $today->copy()->addDays(30))),
            'toWrite' => $totals($company->cheques()->where('direction', 'issued')->where('status', 'pending')->whereDate('cheque_date', '<=', $today->copy()->addDays(30))),
            'bounced' => $totals($company->cheques()->where('status', 'bounced')->whereDoesntHave('replacement')),
            'clearedThisMonth' => $totals($company->cheques()->where('direction', 'received')->where('status', 'cleared')->whereBetween('cleared_on', [$today->copy()->startOfMonth(), $today])),
        ];
    }

    /**
     * Who the listed cheques are from or to, as filter options with how many
     * cheques each has: clients and tenants first, then landlords. A chosen
     * party stays listed even at zero so its filter chip keeps its name.
     *
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return list<array{value: string, label: string, count: int}>
     */
    private function partyFacet(Company $company, array $filters, array $period): array
    {
        $cheques = $this->filteredQuery($company, $filters, $period, except: 'party')
            ->with(['chequeable' => fn (MorphTo $morph) => $morph->morphWith([
                Contract::class => ['client:id,name'],
                HeadLease::class => ['landlord:id,name'],
                RoomRental::class => ['client:id,name'],
            ])])
            ->get(['id', 'chequeable_type', 'chequeable_id']);

        $options = $cheques
            ->map(fn (Cheque $cheque) => match (true) {
                $cheque->chequeable instanceof HeadLease => ['value' => "landlord:{$cheque->chequeable->landlord_id}", 'label' => $cheque->chequeable->landlord?->name, 'type' => 1],
                $cheque->chequeable !== null => ['value' => "client:{$cheque->chequeable->client_id}", 'label' => $cheque->chequeable->client?->name, 'type' => 0],
                default => null,
            })
            ->filter()
            ->groupBy('value')
            ->map(fn ($group, string $value) => ['value' => $value, 'label' => $group->first()['label'] ?? $value, 'count' => $group->count(), 'type' => $group->first()['type']]);

        foreach ($filters['party'] as $chosen) {
            if (! $options->has($chosen)) {
                [$type, $id] = explode(':', $chosen);
                $name = $type === 'client' ? $company->clients()->whereKey($id)->value('name') : $company->landlords()->whereKey($id)->value('name');

                if ($name !== null) {
                    $options->put($chosen, ['value' => $chosen, 'label' => $name, 'count' => 0, 'type' => $type === 'client' ? 0 : 1]);
                }
            }
        }

        return $options
            ->sortBy(fn (array $option) => [$option['type'], mb_strtolower((string) $option['label'])])
            ->map(fn (array $option) => ['value' => $option['value'], 'label' => (string) $option['label'], 'count' => $option['count']])
            ->values()
            ->all();
    }

    /**
     * Money in and out on the cheques listed for a period, by direction.
     *
     * @param  HasMany<Cheque, Company>  $query
     * @return array<string, array{count: int, amount: float, cleared: float}>
     */
    private function periodTotals(HasMany $query): array
    {
        $rows = $query->toBase()
            ->whereNotIn('status', ['cancelled', 'returned'])
            ->groupBy('direction')
            ->selectRaw("direction, count(*) as aggregate, sum(amount) as total, sum(case when status = 'cleared' then amount else 0 end) as cleared")
            ->get()
            ->keyBy('direction');

        return collect(Cheque::DIRECTIONS)
            ->mapWithKeys(fn (string $direction) => [$direction => [
                'count' => (int) ($rows[$direction]->aggregate ?? 0),
                'amount' => round((float) ($rows[$direction]->total ?? 0), 2),
                'cleared' => round((float) ($rows[$direction]->cleared ?? 0), 2),
            ]])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<Cheque, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): HasMany
    {
        $search = $filters['search'];
        $parties = collect($filters['party'])->map(fn (string $party) => explode(':', $party))->groupBy(0)->map(fn ($group) => $group->pluck(1)->map(fn ($id) => (int) $id)->all());

        return $this->wherePeriod($company->cheques(), 'cheque_date', $period)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('cheque_number', "%{$search}%")
                ->orWhereLike('bank_name', "%{$search}%")
                ->orWhereLike('account_holder', "%{$search}%")
                ->orWhereHasMorph('chequeable', [Contract::class], fn (Builder $contracts) => $contracts
                    ->whereLike('contract_number', "%{$search}%")
                    ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%")))
                ->orWhereHasMorph('chequeable', [HeadLease::class], fn (Builder $leases) => $leases
                    ->whereLike('lease_number', "%{$search}%")
                    ->orWhereHas('landlord', fn (Builder $landlords) => $landlords->whereLike('name', "%{$search}%"))
                    ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%")))
                ->orWhereHasMorph('chequeable', [RoomRental::class], fn (Builder $rentals) => $rentals
                    ->whereLike('rental_number', "%{$search}%")
                    ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%")))))
            ->when($except !== 'party' && $parties->isNotEmpty(), fn (Builder $query) => $query->where(function (Builder $query) use ($parties) {
                if ($parties->has('client')) {
                    $query->orWhereHasMorph('chequeable', [Contract::class, RoomRental::class], fn (Builder $agreements) => $agreements->whereIn('client_id', $parties['client']));
                }

                if ($parties->has('landlord')) {
                    $query->orWhereHasMorph('chequeable', [HeadLease::class], fn (Builder $leases) => $leases->whereIn('landlord_id', $parties['landlord']));
                }
            }))
            ->when($filters['direction'] !== [], fn (Builder $query) => $query->whereIn('direction', $filters['direction']))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']))
            ->when($except !== 'purpose' && $filters['purpose'] !== [], fn (Builder $query) => $query->whereIn('purpose', $filters['purpose']))
            ->when($except !== 'due' && $filters['due'] !== [], fn (Builder $query) => $query->where(function (Builder $query) use ($filters) {
                foreach ($filters['due'] as $due) {
                    $query->orWhere(fn (Builder $query) => $this->whereDue($query, $due));
                }
            }));
    }

    /**
     * @template TQuery of Builder|HasMany
     *
     * @param  TQuery  $query
     * @return TQuery
     */
    private function whereDue(Builder|HasMany $query, string $due): Builder|HasMany
    {
        $today = today();

        return match ($due) {
            'overdue' => $query->whereIn('status', ['pending', 'received'])->whereDate('cheque_date', '<', $today),
            'this_week' => $query->open()->whereBetween('cheque_date', [$today, $today->copy()->addDays(7)]),
            'next_30_days' => $query->open()->whereBetween('cheque_date', [$today, $today->copy()->addDays(30)]),
            default => $query->where('status', 'pending')->whereDate('cheque_date', '<=', $today->copy()->addDays(30)),
        };
    }

    /**
     * The cheque's number, or its place in the schedule before it has one.
     */
    private function label(Cheque $cheque): string
    {
        return $cheque->cheque_number ?? "{$cheque->sequence}";
    }
}
