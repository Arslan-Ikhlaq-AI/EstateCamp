<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\ChequeDetailsRequest;
use App\Http\Requests\ChequeReplaceRequest;
use App\Http\Requests\ChequeTransitionRequest;
use App\Models\Cheque;
use App\Models\Company;
use App\Models\Contract;
use App\Models\HeadLease;
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
 * The cheque register: every cheque the company receives from clients or
 * issues to landlords, and what happens to each one.
 */
class ChequeController extends Controller
{
    use ListsRecords;

    public const DUE_FILTERS = ['overdue', 'this_week', 'next_30_days', 'to_collect'];

    /**
     * List the cheques: those still to deal with first, soonest dated on top.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Cheques/Index', ['company' => null]);
        }

        $filters = $this->listFilters($request, [
            'direction' => Cheque::DIRECTIONS,
            'status' => Cheque::STATUSES,
            'due' => self::DUE_FILTERS,
            'purpose' => Cheque::PURPOSES,
        ]);
        $statuses = count($filters['direction']) === 1 ? Cheque::DIRECTION_STATUSES[$filters['direction'][0]] : Cheque::STATUSES;
        $dueQuery = fn () => $this->filteredQuery($company, $filters, except: 'due');

        return Inertia::render('Cheques/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => $this->facetOptions($statuses, $this->countBy($this->filteredQuery($company, $filters, except: 'status'), 'status')),
                'due' => array_map(fn (string $due) => ['value' => $due, 'count' => $this->whereDue($dueQuery(), $due)->count()], self::DUE_FILTERS),
                'purpose' => $this->facetOptions(Cheque::PURPOSES, $this->countBy($this->filteredQuery($company, $filters, except: 'purpose'), 'purpose')),
            ],
            'summary' => self::summary($company),
            'cheques' => $this->filteredQuery($company, $filters)
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
            'clear' => $cheque->direction === 'received' && $cheque->payment
                ? "Cheque {$this->label($cheque)} cleared and was recorded as payment {$cheque->payment->payment_number}."
                : "Cheque {$this->label($cheque)} cleared.",
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
            ]),
            'replacement:id,replaces_id',
            'payment:id,cheque_id,payment_number',
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
        $isContract = $agreement instanceof Contract;
        $version = $cheque->updated_at?->timestamp;

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
            'payment' => $cheque->payment?->only(['id', 'payment_number']),
            'agreement' => $agreement ? [
                'type' => $isContract ? 'contract' : 'head_lease',
                'id' => $agreement->id,
                'number' => $isContract ? $agreement->contract_number : $agreement->lease_number,
            ] : null,
            'party' => match (true) {
                $isContract => ['type' => 'client', 'id' => $agreement->client_id, 'name' => $agreement->client?->name],
                $agreement instanceof HeadLease => ['type' => 'landlord', 'id' => $agreement->landlord_id, 'name' => $agreement->landlord?->name],
                default => null,
            },
            'property' => $agreement instanceof HeadLease ? $agreement->property?->only(['id', 'name', 'code']) : null,
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
     * @param  array<string, mixed>  $filters
     * @return HasMany<Cheque, Company>
     */
    private function filteredQuery(Company $company, array $filters, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->cheques()
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
                    ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%")))))
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
