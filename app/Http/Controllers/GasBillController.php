<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Controllers\Concerns\ReadsCashFlow;
use App\Http\Requests\GasBillRequest;
use App\Models\Company;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\GasBill;
use App\Models\Invoice;
use App\Models\Property;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Gas bills: each month's gas at a property, charged to the clients whose
 * contracts do not include gas, on invoices they pay like any other. The
 * list's period filter matches the month a bill is for, and the list shows
 * which contracts still need a bill for that month.
 */
class GasBillController extends Controller
{
    use FiltersByPeriod, ListsRecords, ReadsCashFlow;

    /**
     * Contracts that ended longer ago than this no longer appear on the form.
     */
    private const FORM_MONTHS_BACK = 12;

    /**
     * List the bills, the latest month first, with the month's bills still to make.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('GasBills/Index', ['company' => null]);
        }

        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $period = $this->periodFilter($request);
        $filters = [
            ...$this->listFilters($request, ['status' => Invoice::STATUSES, 'properties' => $properties->pluck('code')->all()]),
            'period' => $period['value'],
        ];
        $propertyCounts = $this->countBy($this->filteredQuery($company, $filters, $period, except: 'properties'), 'gas_bills.property_id');
        $month = $this->monthOf($period);

        return Inertia::render('GasBills/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'status' => $this->facetOptions(Invoice::STATUSES, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'status'), 'invoices.status')),
                'properties' => $properties->map(fn (Property $property) => ['value' => $property->code, 'label' => $property->name, 'count' => $propertyCounts->get($property->id, 0)])->values(),
            ],
            'summary' => $this->summary($company, $period),
            'toBill' => [
                'month' => $month->format('Y-m'),
                'contracts' => $this->stillToBill($company, $month),
            ],
            'bills' => $this->filteredQuery($company, $filters, $period)
                ->select('gas_bills.*')
                ->with(self::listRelations())
                ->orderByDesc('gas_bills.period_start')
                ->orderByDesc('gas_bills.id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (GasBill $bill) => self::details($bill)),
        ]);
    }

    /**
     * Show the form for a new bill. The contract, property and month can be
     * chosen beforehand (`?contract=&property=&month=`), as the list's
     * "still to bill" links do.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $month = $request->string('month')->toString();

        return Inertia::render('GasBills/Form', [
            'bill' => null,
            'prefill' => [
                'contract_id' => $request->integer('contract') ?: null,
                'property_id' => $request->integer('property') ?: null,
                'month' => preg_match('/^\d{4}-\d{2}$/', $month) ? $month : today()->format('Y-m'),
            ],
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Record a month's gas and issue its invoice to the client.
     */
    public function store(GasBillRequest $request): RedirectResponse
    {
        $contract = $request->contract();
        $period = $request->period();

        $bill = DB::transaction(function () use ($request, $contract, $period) {
            $bill = GasBill::record(
                $contract,
                Property::query()->findOrFail($request->integer('property_id')),
                $period,
                $request->billAttributes(),
                $request->date('issue_date'),
                $request->user(),
            );

            if ($request->file('document')) {
                $bill->storeDocument($request->file('document'));
            }

            return $bill;
        });

        return to_route('gas-bills.index', ['period' => $period[0]->format('Y-m')])
            ->with('success', "Gas bill {$bill->invoice->invoice_number} for {$period[0]->format('F Y')} was issued to {$contract->client->name}.");
    }

    /**
     * Show the form for correcting a bill nothing has been paid towards yet.
     */
    public function edit(Request $request, GasBill $gasBill): Response|RedirectResponse
    {
        $this->ensureSameCompany($request, $gasBill);

        $gasBill->load(self::listRelations());

        if (! $gasBill->isEditable()) {
            return to_route('invoices.show', $gasBill->invoice_id);
        }

        return Inertia::render('GasBills/Form', [
            'bill' => [
                ...self::details($gasBill),
                'paymentTermsDays' => $gasBill->contract->payment_terms_days,
            ],
            'prefill' => null,
            ...$this->formOptions($gasBill->company),
        ]);
    }

    /**
     * Save a corrected bill; its invoice is changed with it.
     */
    public function update(GasBillRequest $request, GasBill $gasBill): RedirectResponse
    {
        DB::transaction(function () use ($request, $gasBill) {
            $gasBill->revise($request->billAttributes(), $request->date('issue_date'));

            if ($request->boolean('remove_document')) {
                $gasBill->removeDocument();
            }

            if ($request->file('document')) {
                $gasBill->storeDocument($request->file('document'));
            }
        });

        return to_route('gas-bills.index', ['period' => $gasBill->period_start->format('Y-m')])
            ->with('success', "Gas bill {$gasBill->invoice->invoice_number} was updated.");
    }

    /**
     * The supplier's bill or meter photo kept with a gas bill.
     */
    public function document(Request $request, GasBill $gasBill): StreamedResponse
    {
        $this->ensureSameCompany($request, $gasBill);

        $path = $gasBill->document_path;

        abort_unless($path && Storage::disk(GasBill::DOCUMENT_DISK)->exists($path), 404);

        return Storage::disk(GasBill::DOCUMENT_DISK)->response($path, $gasBill->document_name, ['Cache-Control' => 'private, max-age=3600']);
    }

    /**
     * What the list and the contract page load with each bill.
     *
     * @return array<int|string, mixed>
     */
    public static function listRelations(): array
    {
        return [
            'contract:id,company_id,client_id,contract_number,payment_terms_days',
            'contract.client:id,name',
            'property:id,name,code',
            'invoice' => fn ($invoices) => $invoices->withCount('allocations'),
        ];
    }

    /**
     * One bill as the list, the contract page and the form show it.
     *
     * @return array<string, mixed>
     */
    public static function details(GasBill $bill): array
    {
        $invoice = $bill->invoice;

        return [
            'id' => $bill->id,
            'invoice' => [
                'id' => $invoice->id,
                'number' => $invoice->invoice_number,
                'status' => $invoice->status,
                'isOverdue' => $invoice->isOverdue(),
                'issueDate' => $invoice->issue_date->toDateString(),
                'dueDate' => $invoice->due_date->toDateString(),
                'vatAmount' => (float) $invoice->vat_amount,
                'total' => (float) $invoice->total,
                'amountPaid' => (float) $invoice->amount_paid,
                'balance' => $invoice->balance(),
            ],
            'contract' => ['id' => $bill->contract->id, 'number' => $bill->contract->contract_number],
            'client' => $bill->contract->client->only(['id', 'name']),
            'property' => $bill->property->only(['id', 'name', 'code']),
            'month' => $bill->period_start->format('Y-m'),
            'periodStart' => $bill->period_start->toDateString(),
            'periodEnd' => $bill->period_end->toDateString(),
            'metered' => $bill->isMetered(),
            'previousReading' => $bill->previous_reading === null ? null : (float) $bill->previous_reading,
            'currentReading' => $bill->current_reading === null ? null : (float) $bill->current_reading,
            'units' => $bill->units(),
            'unitRate' => $bill->unit_rate === null ? null : (float) $bill->unit_rate,
            'amount' => (float) $bill->amount,
            'vatRate' => (float) $bill->vat_rate,
            'supplierReference' => $bill->supplier_reference,
            'notes' => $bill->notes,
            'document' => $bill->document_path === null ? null : [
                'url' => route('gas-bills.document', [$bill, 'v' => $bill->updated_at?->timestamp]),
                'name' => $bill->document_name,
            ],
            'canEdit' => $bill->isEditable(),
        ];
    }

    /**
     * The month the "still to bill" list is for: the chosen period's, when it
     * covers a single month, otherwise this month.
     *
     * @param  array{from: ?string, to: ?string}  $period
     */
    private function monthOf(array $period): CarbonImmutable
    {
        if ($period['from'] !== null && $period['to'] !== null && substr($period['from'], 0, 7) === substr($period['to'], 0, 7)) {
            return CarbonImmutable::parse($period['from'])->startOfMonth();
        }

        return CarbonImmutable::today()->startOfMonth();
    }

    /**
     * Each contract that pays for its gas and runs in `$month`, with every
     * property it rents at that month that has no bill for it yet.
     *
     * @return list<array<string, mixed>>
     */
    private function stillToBill(Company $company, CarbonImmutable $month): array
    {
        $from = $month->toDateString();
        $to = $month->endOfMonth()->toDateString();

        return $company->contracts()
            ->where('gas_included', false)
            ->whereNot('status', 'draft')
            ->whereDate('start_date', '<=', $to)
            ->whereDate(DB::raw('coalesce(terminated_on, end_date)'), '>=', $from)
            ->with([
                'client:id,name',
                'lines' => fn (HasMany $lines) => $lines->whereDate('start_date', '<=', $to)->whereDate('end_date', '>=', $from)->orderBy('id'),
                'lines.property:id,name,code',
                'gasBills' => fn (HasMany $bills) => $bills->whereBetween('period_start', [$from, $to])->whereHas('invoice', fn (Builder $invoices) => $invoices->whereNot('status', 'void')),
            ])
            ->orderBy('contract_number')
            ->get()
            ->flatMap(function (Contract $contract) use ($month) {
                $billed = $contract->gasBills->pluck('property_id')->flip();
                $period = GasBill::periodFor($contract, $month);

                return $contract->lines
                    ->map(fn (ContractLine $line) => $line->property)
                    ->unique('id')
                    ->reject(fn (Property $property) => $billed->has($property->id))
                    ->map(fn (Property $property) => [
                        'key' => "{$contract->id}-{$property->id}",
                        'contract' => ['id' => $contract->id, 'number' => $contract->contract_number, 'status' => $contract->status],
                        'client' => $contract->client->only(['id', 'name']),
                        'property' => $property->only(['id', 'name', 'code']),
                        'periodStart' => $period[0]->toDateString(),
                        'periodEnd' => $period[1]->toDateString(),
                    ]);
            })
            ->values()
            ->all();
    }

    /**
     * The contracts a bill can be for (those paying for their gas, not
     * drafts, still running or ended in the last year), what each rents
     * where, the months already billed at each of their properties, and the
     * last bill there to carry the meter reading and rate on from.
     *
     * @return array<string, mixed>
     */
    private function formOptions(Company $company): array
    {
        $contracts = $company->contracts()
            ->where('gas_included', false)
            ->whereNot('status', 'draft')
            ->whereDate(DB::raw('coalesce(terminated_on, end_date)'), '>=', today()->subMonthsNoOverflow(self::FORM_MONTHS_BACK))
            ->with(['client:id,name', 'lines:id,contract_id,property_id', 'lines.property:id,name,code'])
            ->orderByRaw("case status when 'active' then 0 else 1 end")
            ->orderBy('contract_number')
            ->get();

        $bills = $company->gasBills()
            ->whereIn('contract_id', $contracts->modelKeys())
            ->whereHas('invoice', fn (Builder $invoices) => $invoices->whereNot('status', 'void'))
            ->with('invoice:id,invoice_number')
            ->orderByDesc('period_start')
            ->orderByDesc('id')
            ->get();
        $pair = fn (GasBill $bill) => "{$bill->contract_id}-{$bill->property_id}";

        return [
            'currency' => $company->default_currency,
            'contracts' => $contracts->map(fn (Contract $contract) => [
                'id' => $contract->id,
                'number' => $contract->contract_number,
                'status' => $contract->status,
                'client' => $contract->client->only(['id', 'name']),
                'startDate' => $contract->start_date->toDateString(),
                'lastDay' => ($contract->terminated_on ?? $contract->end_date)->toDateString(),
                'paymentTermsDays' => $contract->payment_terms_days,
                'properties' => $contract->lines->pluck('property')->unique('id')->map(fn (Property $property) => $property->only(['id', 'name', 'code']))->values(),
            ]),
            'billedMonths' => $bills->groupBy($pair)->map(fn (Collection $billed) => $billed->mapWithKeys(fn (GasBill $bill) => [$bill->period_start->format('Y-m') => $bill->invoice->invoice_number])),
            'lastBills' => $bills->unique($pair)->mapWithKeys(fn (GasBill $bill) => [$pair($bill) => [
                'month' => $bill->period_start->format('Y-m'),
                'currentReading' => $bill->current_reading === null ? null : (float) $bill->current_reading,
                'unitRate' => $bill->unit_rate === null ? null : (float) $bill->unit_rate,
                'amount' => (float) $bill->amount,
                'vatRate' => (float) $bill->vat_rate,
            ]]),
        ];
    }

    /**
     * Headline figures. What is owed stands as of today; what was billed and
     * collected covers the chosen period, or this month when the list shows
     * all time.
     *
     * @param  array{kind: string, from: ?string, to: ?string}  $period
     * @return array<string, mixed>
     */
    private function summary(Company $company, array $period): array
    {
        $range = $period['kind'] === 'all' ? ['from' => today()->startOfMonth()->toDateString(), 'to' => today()->endOfMonth()->toDateString()] : $period;
        $billed = $this->wherePeriod($company->gasBills()->join('invoices', 'invoices.id', '=', 'gas_bills.invoice_id')->whereNot('invoices.status', 'void'), 'gas_bills.period_start', $range);
        $collected = $this->wherePeriod($this->cashLedger($company, false)->where('category', 'gas_payment'), 'date', $range);
        $open = fn () => $company->invoices()->where('kind', 'gas')->whereIn('status', ['issued', 'partially_paid']);

        return [
            'inPeriod' => $period['kind'] !== 'all',
            'billed' => ['count' => (clone $billed)->count(), 'amount' => round((float) (clone $billed)->sum('invoices.total'), 2)],
            'collected' => ['count' => (clone $collected)->count(), 'amount' => round((float) (clone $collected)->sum('amount'), 2)],
            'outstanding' => [
                'count' => $open()->count(),
                'amount' => round((float) $open()->sum(DB::raw('total - amount_paid')), 2),
                'overdue' => $open()->whereDate('due_date', '<', today())->count(),
            ],
            'contracts' => $company->contracts()->where('gas_included', false)->where('status', 'active')->count(),
        ];
    }

    /**
     * The company's bills, with their invoices joined, narrowed by the search
     * and the filters, leaving out the filter named in `$except`.
     *
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<GasBill, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $this->wherePeriod($company->gasBills()->join('invoices', 'invoices.id', '=', 'gas_bills.invoice_id'), 'gas_bills.period_start', $period)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('invoices.invoice_number', "%{$search}%")
                ->orWhereLike('gas_bills.supplier_reference', "%{$search}%")
                ->orWhereHas('contract', fn (Builder $contracts) => $contracts
                    ->whereLike('contract_number', "%{$search}%")
                    ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%")))
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%"))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('invoices.status', $filters['status']))
            ->when($except !== 'properties' && $filters['properties'] !== [], fn (Builder $query) => $query
                ->whereHas('property', fn (Builder $properties) => $properties->whereIn('code', $filters['properties'])));
    }
}
