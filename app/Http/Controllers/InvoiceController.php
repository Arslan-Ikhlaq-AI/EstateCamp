<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Models\Company;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\PaymentAllocation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InvoiceController extends Controller
{
    use FiltersByPeriod, ListsRecords;

    /**
     * List the company's invoices, newest first, issued in a period when one is chosen.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Invoices/Index', ['company' => null]);
        }

        $period = $this->periodFilter($request);
        $filters = [...$this->listFilters($request, ['status' => Invoice::STATUSES, 'kind' => Invoice::KINDS, 'due' => ['overdue']]), 'period' => $period['value']];

        return Inertia::render('Invoices/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'status' => $this->facetOptions(Invoice::STATUSES, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'status'), 'status')),
                'kind' => $this->facetOptions(Invoice::KINDS, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'kind'), 'kind')),
                'due' => [['value' => 'overdue', 'count' => $this->overdue($this->filteredQuery($company, $filters, $period, except: 'due'))->count()]],
            ],
            'summary' => $this->summary($company, $period),
            'invoices' => $this->filteredQuery($company, $filters, $period)
                ->with(['client:id,name', 'contract:id,contract_number'])
                ->orderByDesc('issue_date')
                ->orderByDesc('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Invoice $invoice) => self::listDetails($invoice)),
        ]);
    }

    /**
     * Bill a contract's next period.
     */
    public function store(Request $request, Contract $contract): RedirectResponse
    {
        $this->ensureSameCompany($request, $contract);

        $invoice = $contract->generateNextInvoice();

        if ($invoice === null) {
            return back()->with('success', "Every billing period of {$contract->contract_number} is already invoiced.");
        }

        return to_route('invoices.show', $invoice)->with('success', "Invoice {$invoice->invoice_number} was issued for {$contract->contract_number}.");
    }

    /**
     * Show an invoice with its items and the payments allocated to it, and
     * the gas bill a gas invoice charges for.
     */
    public function show(Request $request, Invoice $invoice): Response
    {
        $this->ensureSameCompany($request, $invoice);

        $invoice->load([
            'client:id,name,client_type,email,phone,address,tax_registration_number',
            'contract:id,contract_number,billing_cycle',
            'items' => fn (HasMany $items) => $items->orderBy('id'),
            'allocations.payment:id,payment_number,received_on,method,status',
            'gasBill.property:id,name,code',
        ]);

        return Inertia::render('Invoices/Show', [
            'currency' => $invoice->company->default_currency,
            'company' => $invoice->company->only(['name', 'legal_name', 'tax_registration_number', 'address_line_1', 'address_line_2', 'city', 'phone', 'email', 'logo_url']),
            'invoice' => [
                ...self::listDetails($invoice),
                'subtotal' => (float) $invoice->subtotal,
                'vatAmount' => (float) $invoice->vat_amount,
                'notes' => $invoice->notes,
                'client' => $invoice->client->only(['id', 'name', 'client_type', 'email', 'phone', 'address', 'tax_registration_number']),
                'canVoid' => $invoice->status !== 'void' && $invoice->allocations->isEmpty(),
                'gasBill' => $invoice->gasBill ? [
                    'id' => $invoice->gasBill->id,
                    'property' => $invoice->gasBill->property->only(['id', 'name', 'code']),
                    'canEdit' => $invoice->status === 'issued' && $invoice->allocations->isEmpty(),
                ] : null,
            ],
            'items' => $invoice->items->map(fn (InvoiceItem $item) => [
                'id' => $item->id,
                'type' => $item->item_type,
                'description' => $item->description,
                'quantity' => (float) $item->quantity,
                'unitPrice' => (float) $item->unit_price,
                'vatRate' => (float) $item->vat_rate,
                'amount' => (float) $item->amount,
                'vatAmount' => (float) $item->vat_amount,
            ]),
            'allocations' => $invoice->allocations->map(fn (PaymentAllocation $allocation) => [
                'id' => $allocation->id,
                'amount' => (float) $allocation->amount,
                'payment' => [
                    'id' => $allocation->payment->id,
                    'number' => $allocation->payment->payment_number,
                    'receivedOn' => $allocation->payment->received_on->toDateString(),
                    'method' => $allocation->payment->method,
                    'status' => $allocation->payment->status,
                ],
            ]),
        ]);
    }

    /**
     * Cancel an invoice issued by mistake; its period can then be invoiced again.
     */
    public function void(Request $request, Invoice $invoice): RedirectResponse
    {
        $this->ensureSameCompany($request, $invoice);

        $invoice->void();

        return back()->with('success', "Invoice {$invoice->invoice_number} was voided.");
    }

    /**
     * An invoice as the lists show it.
     *
     * @return array<string, mixed>
     */
    public static function listDetails(Invoice $invoice): array
    {
        return [
            'id' => $invoice->id,
            'number' => $invoice->invoice_number,
            'kind' => $invoice->kind,
            'status' => $invoice->status,
            'isOverdue' => $invoice->isOverdue(),
            'client' => $invoice->relationLoaded('client') ? $invoice->client?->only(['id', 'name']) : null,
            'contract' => $invoice->relationLoaded('contract') ? ['id' => $invoice->contract->id, 'number' => $invoice->contract->contract_number] : null,
            'issueDate' => $invoice->issue_date->toDateString(),
            'dueDate' => $invoice->due_date->toDateString(),
            'periodStart' => $invoice->period_start->toDateString(),
            'periodEnd' => $invoice->period_end->toDateString(),
            'total' => (float) $invoice->total,
            'amountPaid' => (float) $invoice->amount_paid,
            'balance' => $invoice->balance(),
        ];
    }

    /**
     * Unpaid invoices whose due date has passed.
     *
     * @param  HasMany<Invoice, Company>  $query
     * @return HasMany<Invoice, Company>
     */
    private function overdue(HasMany $query): HasMany
    {
        return $query->whereIn('status', ['issued', 'partially_paid'])->whereDate('due_date', '<', today());
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<Invoice, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        $query = $this->wherePeriod($company->invoices(), 'issue_date', $period)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('invoice_number', "%{$search}%")
                ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%"))
                ->orWhereHas('contract', fn (Builder $contracts) => $contracts->whereLike('contract_number', "%{$search}%"))))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']))
            ->when($except !== 'kind' && $filters['kind'] !== [], fn (Builder $query) => $query->whereIn('kind', $filters['kind']));

        return $except !== 'due' && $filters['due'] !== [] ? $this->overdue($query) : $query;
    }

    /**
     * Headline figures. What is outstanding and overdue stands as of today;
     * what was invoiced and collected covers the chosen period, or this
     * month when the list shows all time.
     *
     * @param  array{kind: string, from: ?string, to: ?string}  $period
     * @return array<string, mixed>
     */
    private function summary(Company $company, array $period): array
    {
        $open = fn () => $company->invoices()->whereIn('status', ['issued', 'partially_paid']);
        $range = $period['kind'] === 'all' ? ['from' => today()->startOfMonth()->toDateString(), 'to' => today()->endOfMonth()->toDateString()] : $period;

        return [
            'outstanding' => round((float) $open()->sum(DB::raw('total - amount_paid')), 2),
            'overdue' => [
                'count' => $this->overdue($open())->count(),
                'amount' => round((float) $this->overdue($open())->sum(DB::raw('total - amount_paid')), 2),
            ],
            'invoiced' => round((float) $this->wherePeriod($company->invoices()->whereNot('status', 'void'), 'issue_date', $range)->sum('total'), 2),
            'collected' => round((float) $this->wherePeriod($company->payments()->where('status', 'cleared'), 'received_on', $range)->sum('amount'), 2),
            'inPeriod' => $period['kind'] !== 'all',
        ];
    }
}
