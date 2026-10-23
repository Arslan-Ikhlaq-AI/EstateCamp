<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\PaymentRequest;
use App\Http\Requests\PaymentStatusRequest;
use App\Models\Company;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Money received from clients.
 */
class PaymentController extends Controller
{
    use FiltersByPeriod, ListsRecords;

    /**
     * List payments received, newest first, over a period when one is chosen.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Payments/Index', ['company' => null]);
        }

        $period = $this->periodFilter($request);
        $filters = [...$this->listFilters($request, ['method' => Payment::METHODS, 'status' => Payment::STATUSES]), 'period' => $period['value']];

        return Inertia::render('Payments/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'method' => $this->facetOptions(Payment::METHODS, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'method'), 'method')),
                'status' => $this->facetOptions(Payment::STATUSES, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'status'), 'status')),
            ],
            'summary' => $this->summary($company, $period),
            'payments' => $this->filteredQuery($company, $filters, $period)
                ->with('client:id,name')
                ->withSum('allocations as allocated', 'amount')
                ->orderByDesc('received_on')
                ->orderByDesc('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (Payment $payment) => [
                    ...$this->paymentDetails($payment),
                    'allocated' => round((float) $payment->allocated, 2),
                ]),
        ]);
    }

    /**
     * Show the form for recording a payment. Choosing a client (`?client=`)
     * loads their open invoices; `?invoice=` preselects one to pay.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $client = $request->integer('client') ? $company->clients()->find($request->integer('client')) : null;

        return Inertia::render('Payments/Form', [
            'currency' => $company->default_currency,
            'clients' => $company->clients()->orderBy('name')->get(['id', 'name', 'client_type']),
            'clientId' => $client?->id,
            'invoiceId' => $request->integer('invoice') ?: null,
            'openInvoices' => $client ? $client->invoices()
                ->whereIn('status', ['issued', 'partially_paid'])
                ->with('contract:id,contract_number')
                ->orderBy('due_date')
                ->orderBy('id')
                ->get()
                ->map(fn (Invoice $invoice) => InvoiceController::listDetails($invoice)) : [],
            'methods' => Payment::METHODS,
        ]);
    }

    /**
     * Record a payment and spread it over the chosen invoices.
     */
    public function store(PaymentRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);

        $payment = DB::transaction(function () use ($request, $company) {
            $payment = new Payment($request->paymentAttributes());
            $payment->forceFill([
                'company_id' => $company->id,
                'client_id' => $request->validated('client_id'),
                'payment_number' => Payment::nextNumber($company->id, $request->date('received_on')),
            ])->save();

            $payment->allocate(collect($request->validated('allocations', []))
                ->mapWithKeys(fn (array $allocation) => [$allocation['invoice_id'] => (float) $allocation['amount']])
                ->all());

            return $payment;
        });

        return to_route('payments.show', $payment)->with('success', "Payment {$payment->payment_number} was recorded.");
    }

    /**
     * Show a payment and the invoices it settles.
     */
    public function show(Request $request, Payment $payment): Response
    {
        $this->ensureSameCompany($request, $payment);

        $payment->load(['client:id,name,client_type', 'allocations.invoice']);

        return Inertia::render('Payments/Show', [
            'currency' => $payment->company->default_currency,
            'payment' => [
                ...$this->paymentDetails($payment),
                'notes' => $payment->notes,
                'allocated' => $payment->allocatedAmount(),
            ],
            'allocations' => $payment->allocations->map(fn (PaymentAllocation $allocation) => [
                'id' => $allocation->id,
                'amount' => (float) $allocation->amount,
                'invoice' => InvoiceController::listDetails($allocation->invoice),
            ]),
        ]);
    }

    /**
     * Record that a cheque cleared or bounced.
     */
    public function update(PaymentStatusRequest $request, Payment $payment): RedirectResponse
    {
        $payment->changeStatus($request->validated('status'));

        $word = ['pending' => 'pending', 'cleared' => 'cleared', 'bounced' => 'bounced'][$payment->status];

        return back()->with('success', "Payment {$payment->payment_number} is now {$word}; its invoices were updated.");
    }

    /**
     * @return array<string, mixed>
     */
    private function paymentDetails(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'number' => $payment->payment_number,
            'client' => $payment->client?->only(['id', 'name']),
            'receivedOn' => $payment->received_on->toDateString(),
            'amount' => (float) $payment->amount,
            'method' => $payment->method,
            'status' => $payment->status,
            'reference' => $payment->reference,
            'chequeNumber' => $payment->cheque_number,
            'chequeDate' => $payment->cheque_date?->toDateString(),
            'bankName' => $payment->bank_name,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<Payment, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $this->wherePeriod($company->payments(), 'received_on', $period)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('payment_number', "%{$search}%")
                ->orWhereLike('cheque_number', "%{$search}%")
                ->orWhereLike('reference', "%{$search}%")
                ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%"))))
            ->when($except !== 'method' && $filters['method'] !== [], fn (Builder $query) => $query->whereIn('method', $filters['method']))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']));
    }

    /**
     * Headline figures. What was received covers the chosen period, or this
     * month when the list shows all time; the rest stand as of today.
     *
     * @param  array{kind: string, from: ?string, to: ?string}  $period
     * @return array<string, mixed>
     */
    private function summary(Company $company, array $period): array
    {
        $receivedPeriod = $period['kind'] === 'all' ? ['from' => today()->startOfMonth()->toDateString(), 'to' => today()->endOfMonth()->toDateString()] : $period;
        $withStatus = fn (string $status) => $company->payments()->where('status', $status);
        $allocated = (float) PaymentAllocation::query()
            ->whereHas('payment', fn (Builder $payments) => $payments->where('company_id', $company->id)->whereNot('status', 'bounced'))
            ->sum('amount');
        $received = $this->wherePeriod($withStatus('cleared'), 'received_on', $receivedPeriod);

        return [
            'received' => ['amount' => round((float) (clone $received)->sum('amount'), 2), 'count' => (clone $received)->count(), 'inPeriod' => $period['kind'] !== 'all'],
            'pending' => ['count' => $withStatus('pending')->count(), 'amount' => round((float) $withStatus('pending')->sum('amount'), 2)],
            'bounced' => ['count' => $withStatus('bounced')->count(), 'amount' => round((float) $withStatus('bounced')->sum('amount'), 2)],
            'unallocated' => round(max(0, (float) $company->payments()->whereNot('status', 'bounced')->sum('amount') - $allocated), 2),
        ];
    }
}
