<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\ChequeBulkStatusRequest;
use App\Http\Requests\ChequeDetailsRequest;
use App\Http\Requests\ChequeReplaceRequest;
use App\Http\Requests\ChequeStatusChangeRequest;
use App\Models\Cheque;
use App\Models\ChequeStatus;
use App\Models\ChequeUpdate;
use App\Models\Company;
use App\Models\Contract;
use App\Models\HeadLease;
use App\Models\MaintenanceContract;
use App\Models\RoomRental;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The cheque register: every cheque the company receives from clients and
 * individual tenants or issues to landlords and maintenance contractors,
 * and what happens to each one, moved through the company's cheque
 * statuses one at a time or several together.
 */
class ChequeController extends Controller
{
    use FiltersByPeriod, ListsRecords;

    public const DUE_FILTERS = ['overdue', 'this_week', 'next_30_days', 'to_collect'];

    /**
     * List the cheques: those still to deal with first, soonest dated on top.
     * A period narrows them to those dated in it; `party` to the cheques of
     * chosen clients, tenants or landlords (`client:12`, `landlord:3`). The
     * status filter holds the slugs of the company's cheque statuses; links
     * from elsewhere can ask for a `stage` instead, which becomes the slugs
     * of that stage's statuses.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Cheques/Index', ['company' => null]);
        }

        $statuses = ChequeStatus::query()->orderBy('sort_order')->orderBy('name')->get();
        $period = $this->periodFilter($request);
        $filters = [
            ...$this->listFilters($request, [
                'direction' => Cheque::DIRECTIONS,
                'status' => $statuses->pluck('slug')->all(),
                'due' => self::DUE_FILTERS,
                'purpose' => Cheque::PURPOSES,
                'party' => null,
            ]),
            'period' => $period['value'],
        ];
        $filters['party'] = array_values(array_filter($filters['party'], fn (string $party) => preg_match('/^(client|landlord):\d+$/', $party) === 1));
        $stages = $this->listFilters($request, ['stage' => Cheque::STATUSES])['stage'];

        if ($stages !== []) {
            $filters['status'] = array_values(array_unique([...$filters['status'], ...$statuses->whereIn('stage', $stages)->pluck('slug')->all()]));
        }

        $listedStatuses = count($filters['direction']) === 1
            ? $statuses->filter(fn (ChequeStatus $status) => in_array($filters['direction'][0], $status->directions(), true))
            : $statuses;
        $dueQuery = fn () => $this->filteredQuery($company, $filters, $period, except: 'due');

        return Inertia::render('Cheques/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'status' => $this->statusFacet($listedStatuses, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'status'), 'cheque_status_id')),
                'due' => array_map(fn (string $due) => ['value' => $due, 'count' => $this->whereDue($dueQuery(), $due)->count()], self::DUE_FILTERS),
                'purpose' => $this->facetOptions(Cheque::PURPOSES, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'purpose'), 'purpose')),
                'party' => $this->partyFacet($company, $filters, $period),
            ],
            'summary' => self::summary($company),
            'statuses' => self::statusOptions(),
            'periodTotals' => $period['kind'] === 'all' ? null : $this->periodTotals($this->filteredQuery($company, $filters, $period)),
            'cheques' => $this->filteredQuery($company, $filters, $period)
                ->with([...self::detailRelations(), ...self::historyRelations()])
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
     * Move a cheque to another of the company's statuses: one that deposits,
     * clears, bounces, hands back or cancels it, or another name for where
     * it already stands.
     */
    public function changeStatus(ChequeStatusChangeRequest $request, Cheque $cheque): RedirectResponse
    {
        $status = $request->newStatus();

        $cheque->moveTo($status, $request->date('date'), $request->validated('note'), $request->validated('reason'), $request->user());

        $message = match (true) {
            $status->stage === 'cleared' && $cheque->payment !== null => "Cheque {$this->label($cheque)} is now {$status->name} and was recorded as payment {$cheque->payment->payment_number}.",
            $status->stage === 'cleared' && $cheque->rentalPayment !== null => "Cheque {$this->label($cheque)} is now {$status->name} and was recorded as receipt {$cheque->rentalPayment->receipt_number}.",
            $status->stage === 'bounced' => "Cheque {$this->label($cheque)} is now {$status->name}. Record the replacement cheque when it arrives.",
            default => "Cheque {$this->label($cheque)} is now {$status->name}.",
        };

        return back()->with('success', $message);
    }

    /**
     * Move the cheques chosen on the register to one status together.
     * Cheques that cannot take that move now are left as they are.
     *
     * @throws ValidationException When none of the chosen cheques can move.
     */
    public function bulkStatus(ChequeBulkStatusRequest $request): RedirectResponse
    {
        $status = $request->newStatus();
        $moved = 0;
        $left = 0;

        foreach ($request->cheques() as $cheque) {
            try {
                $cheque->moveTo($status, $request->date('date'), $request->validated('note'), $request->validated('reason'), $request->user());
                $moved++;
            } catch (ValidationException) {
                $left++;
            }
        }

        if ($moved === 0) {
            throw ValidationException::withMessages(['cheque_status_id' => "None of the chosen cheques can move to {$status->name} right now."]);
        }

        $message = "{$moved} ".Str::plural('cheque', $moved)." moved to {$status->name}.";

        if ($left > 0) {
            $message .= " {$left} could not move to it yet and ".($left === 1 ? 'was' : 'were').' left as '.($left === 1 ? 'it was.' : 'they were.');
        }

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
     * Build the cheque schedule of a maintenance contract that has none yet,
     * such as one added before its cheques were tracked.
     */
    public function scheduleMaintenanceContract(Request $request, MaintenanceContract $maintenanceContract): RedirectResponse
    {
        $this->ensureSameCompany($request, $maintenanceContract);

        $maintenanceContract->syncCheques([], $request->user());

        return back()->with('success', "The cheque schedule of {$maintenanceContract->contract_number} was set up. Record each cheque as you write it.");
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
                MaintenanceContract::class => ['property:id,name,code'],
                RoomRental::class => ['client:id,name', 'property:id,name,code'],
            ]),
            'chequeStatus:id,name,slug,color,stage',
            'replacement:id,replaces_id',
            'payment:id,cheque_id,payment_number',
            'rentalPayment:id,cheque_id,receipt_number,status',
        ];
    }

    /**
     * The relations a cheque's history needs, for the pages where cheques are updated.
     *
     * @return array<string, mixed>
     */
    public static function historyRelations(): array
    {
        return [
            'updates' => fn (HasMany $updates) => $updates
                ->with(['status:id,name,slug,color,stage', 'previousStatus:id,name,slug,color,stage', 'user:id,name'])
                ->latest('changed_on')
                ->latest('id'),
        ];
    }

    /**
     * The cheque statuses offered when updating cheques, in order, with the
     * stage each means and which cheques (received, issued) it applies to.
     *
     * @return list<array<string, mixed>>
     */
    public static function statusOptions(): array
    {
        return ChequeStatus::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (ChequeStatus $status) => [...$status->only(['id', 'name', 'slug', 'description', 'stage', 'color']), 'directions' => $status->directions()])
            ->all();
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
            'chequeStatus' => $cheque->chequeStatus?->only(['id', 'name', 'slug', 'color', 'stage']),
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
                $agreement instanceof MaintenanceContract => ['type' => 'maintenance_contract', 'id' => $agreement->id, 'number' => $agreement->contract_number, 'service' => $agreement->service],
                default => null,
            },
            // A contractor is known by name only, so their cheques open the contract.
            'party' => match (true) {
                $agreement instanceof Contract, $agreement instanceof RoomRental => ['type' => 'client', 'id' => $agreement->client_id, 'name' => $agreement->client?->name],
                $agreement instanceof HeadLease => ['type' => 'landlord', 'id' => $agreement->landlord_id, 'name' => $agreement->landlord?->name],
                $agreement instanceof MaintenanceContract => ['type' => 'vendor', 'id' => null, 'name' => $agreement->vendor_name],
                default => null,
            },
            'property' => $agreement instanceof HeadLease || $agreement instanceof RoomRental || $agreement instanceof MaintenanceContract
                ? $agreement->property?->only(['id', 'name', 'code'])
                : null,
            'history' => $cheque->relationLoaded('updates') ? $cheque->updates->map(fn (ChequeUpdate $update) => [
                'id' => $update->id,
                'status' => $update->status?->only(['id', 'name', 'slug', 'color', 'stage']),
                'previous' => $update->previousStatus?->only(['id', 'name', 'slug', 'color', 'stage']),
                'changedOn' => $update->changed_on->toDateString(),
                'note' => $update->note,
                'by' => $update->user?->name,
            ])->all() : null,
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
            'cheque_status' => $cheque->chequeStatus?->only(['id', 'name', 'slug', 'color', 'stage']),
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
     * The cheque statuses as filter options, by slug, with each one's name,
     * colour and stage and how many listed cheques are in it. A switched-off
     * status is listed only while cheques are in it.
     *
     * @param  Collection<int, ChequeStatus>  $statuses
     * @param  Collection<array-key, int>  $counts  by status id
     * @return list<array<string, mixed>>
     */
    private function statusFacet(Collection $statuses, Collection $counts): array
    {
        return $statuses
            ->filter(fn (ChequeStatus $status) => $status->is_active || $counts->get($status->id, 0) > 0)
            ->map(fn (ChequeStatus $status) => [
                'value' => $status->slug,
                'label' => $status->name,
                'color' => $status->color,
                'stage' => $status->stage,
                'count' => $counts->get($status->id, 0),
            ])
            ->values()
            ->all();
    }

    /**
     * Who the listed cheques are from or to, as filter options with how many
     * cheques each has: clients and tenants first, then landlords.
     * Contractors are not listed; search finds their cheques by name. A
     * chosen party stays listed even at zero so its filter chip keeps its name.
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
                $cheque->chequeable instanceof Contract, $cheque->chequeable instanceof RoomRental => ['value' => "client:{$cheque->chequeable->client_id}", 'label' => $cheque->chequeable->client?->name, 'type' => 0],
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
                    ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%")))
                ->orWhereHasMorph('chequeable', [MaintenanceContract::class], fn (Builder $contracts) => $contracts
                    ->whereLike('contract_number', "%{$search}%")
                    ->orWhereLike('vendor_name', "%{$search}%")
                    ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%")))))
            ->when($except !== 'party' && $parties->isNotEmpty(), fn (Builder $query) => $query->where(function (Builder $query) use ($parties) {
                if ($parties->has('client')) {
                    $query->orWhereHasMorph('chequeable', [Contract::class, RoomRental::class], fn (Builder $agreements) => $agreements->whereIn('client_id', $parties['client']));
                }

                if ($parties->has('landlord')) {
                    $query->orWhereHasMorph('chequeable', [HeadLease::class], fn (Builder $leases) => $leases->whereIn('landlord_id', $parties['landlord']));
                }
            }))
            ->when($filters['direction'] !== [], fn (Builder $query) => $query->whereIn('direction', $filters['direction']))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('cheque_status_id', ChequeStatus::query()->whereIn('slug', $filters['status'])->select('id')))
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
