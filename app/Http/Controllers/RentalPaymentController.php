<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\RentalPaymentRequest;
use App\Http\Requests\RentalPaymentVoidRequest;
use App\Models\Company;
use App\Models\RentalPayment;
use App\Models\RoomRental;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Rent collections: the receipts for what individual tenants paid, the
 * cheques they handed over, and a printable receipt for each payment.
 */
class RentalPaymentController extends Controller
{
    use FiltersByPeriod, ListsRecords;

    /**
     * List the receipts, newest first, paid in a period when one is chosen.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('RentalPayments/Index', ['company' => null]);
        }

        $period = $this->periodFilter($request);
        $filters = [
            ...$this->listFilters($request, ['purpose' => RentalPayment::PURPOSES, 'method' => RentalPayment::METHODS, 'status' => RentalPayment::STATUSES]),
            'period' => $period['value'],
        ];

        return Inertia::render('RentalPayments/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'purpose' => $this->facetOptions(RentalPayment::PURPOSES, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'purpose'), 'purpose')),
                'method' => $this->facetOptions(RentalPayment::METHODS, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'method'), 'method')),
                'status' => $this->facetOptions(RentalPayment::STATUSES, $this->countBy($this->filteredQuery($company, $filters, $period, except: 'status'), 'status')),
            ],
            'summary' => $this->summary($company, $period),
            'payments' => $this->filteredQuery($company, $filters, $period)
                ->with(['rental:id,rental_number,client_id,property_id', 'rental.client:id,name', 'rental.rooms' => fn ($rooms) => $rooms->withTrashed()->select(['rooms.id', 'room_number'])->orderBy('room_number'), 'rental.property:id,name'])
                ->orderByDesc('paid_on')
                ->orderByDesc('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (RentalPayment $payment) => self::details($payment)),
        ]);
    }

    /**
     * Record what a tenant paid. A cheque goes to the cheque register and
     * becomes a receipt when it clears; anything else is a receipt now.
     */
    public function store(RentalPaymentRequest $request, RoomRental $roomRental): RedirectResponse
    {
        if ($request->validated('method') === 'cheque') {
            $cheque = $roomRental->receiveCheque($request->cheque(), $request->user());

            return back()->with('success', "Cheque {$cheque->cheque_number} from {$roomRental->client->name} is in hand. It counts towards the {$this->purposeWord($request->validated('purpose'))} once it clears.");
        }

        $payment = $roomRental->recordPayment($request->safe()->only(['paid_on', 'amount', 'purpose', 'method', 'reference', 'notes']), $request->user());

        return back()->with('success', "Receipt {$payment->receipt_number} was recorded for {$roomRental->client->name}.");
    }

    /**
     * A receipt, ready to print or hand to the tenant.
     */
    public function show(Request $request, RentalPayment $rentalPayment): Response
    {
        $this->ensureSameCompany($request, $rentalPayment);

        $rentalPayment->load([
            'rental' => fn ($query) => $query->with([
                ...RoomRentalController::listRelations(),
                'client:id,name,phone,email,id_type,id_number',
            ]),
            'receivedBy:id,name',
            'cheque:id,cheque_number,bank_name,cheque_date',
        ]);
        $rental = $rentalPayment->rental;
        $company = $rentalPayment->company;

        return Inertia::render('RentalPayments/Show', [
            'currency' => $company->default_currency,
            'company' => $company->only(['name', 'legal_name', 'tax_registration_number', 'address_line_1', 'address_line_2', 'city', 'phone', 'email', 'logo_url']),
            'payment' => [
                ...self::details($rentalPayment),
                'notes' => $rentalPayment->notes,
                'receivedBy' => $rentalPayment->receivedBy?->name,
                'cheque' => $rentalPayment->cheque ? [
                    'number' => $rentalPayment->cheque->cheque_number,
                    'bank' => $rentalPayment->cheque->bank_name,
                    'date' => $rentalPayment->cheque->cheque_date->toDateString(),
                ] : null,
                'canVoid' => ! $rentalPayment->isVoid() && $rentalPayment->cheque_id === null,
            ],
            'rental' => [
                ...RoomRentalController::listDetails($rental, $rental->rentStanding()),
                'client' => $rental->client->only(['id', 'name', 'phone', 'email', 'id_type', 'id_number']),
            ],
        ]);
    }

    /**
     * Void a receipt made by mistake; it stays on record but no longer counts.
     */
    public function void(RentalPaymentVoidRequest $request, RentalPayment $rentalPayment): RedirectResponse
    {
        $rentalPayment->void(today(), $request->validated('reason'));

        return back()->with('success', "Receipt {$rentalPayment->receipt_number} was voided.");
    }

    /**
     * One receipt as the lists and the receipt page show it.
     *
     * @return array<string, mixed>
     */
    public static function details(RentalPayment $payment): array
    {
        $rental = $payment->relationLoaded('rental') ? $payment->rental : null;

        return [
            'id' => $payment->id,
            'number' => $payment->receipt_number,
            'paidOn' => $payment->paid_on->toDateString(),
            'amount' => (float) $payment->amount,
            'purpose' => $payment->purpose,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'periodStart' => $payment->period_start?->toDateString(),
            'periodEnd' => $payment->period_end?->toDateString(),
            'status' => $payment->status,
            'voidedOn' => $payment->voided_on?->toDateString(),
            'voidReason' => $payment->void_reason,
            'fromCheque' => $payment->cheque_id !== null,
            'receivedBy' => $payment->relationLoaded('receivedBy') ? $payment->receivedBy?->name : null,
            'awaitsHandover' => $payment->awaitsHandover(),
            'handedOverOn' => $payment->handed_over_at?->toDateString(),
            'handedOverTo' => $payment->relationLoaded('handedOverTo') ? $payment->handedOverTo?->name : null,
            'rental' => $rental ? [
                'id' => $rental->id,
                'number' => $rental->rental_number,
                'tenant' => $rental->relationLoaded('client') ? $rental->client?->only(['id', 'name']) : null,
                'rooms' => $rental->relationLoaded('rooms') ? $rental->rooms->pluck('room_number')->all() : [],
                'property' => $rental->relationLoaded('property') ? $rental->property?->name : null,
            ] : null,
        ];
    }

    /**
     * Headline figures. What was collected covers the chosen period, or this
     * month when the list shows all time; cheques waiting stand as of today.
     *
     * @param  array{kind: string, from: ?string, to: ?string}  $period
     * @return array<string, mixed>
     */
    private function summary(Company $company, array $period): array
    {
        $range = $period['kind'] === 'all' ? ['from' => today()->startOfMonth()->toDateString(), 'to' => today()->endOfMonth()->toDateString()] : $period;
        $cleared = $this->wherePeriod($company->rentalPayments()->where('status', 'cleared'), 'paid_on', $range);
        $byPurpose = (clone $cleared)->toBase()->groupBy('purpose')->selectRaw('purpose, sum(amount) as total')->pluck('total', 'purpose');
        $waiting = $company->cheques()->where('chequeable_type', (new RoomRental)->getMorphClass())->whereIn('status', ['received', 'deposited']);

        return [
            'inPeriod' => $period['kind'] !== 'all',
            'collected' => ['amount' => round((float) (clone $cleared)->sum('amount'), 2), 'count' => (clone $cleared)->count()],
            'byPurpose' => collect(RentalPayment::PURPOSES)->mapWithKeys(fn (string $purpose) => [$purpose => round((float) ($byPurpose[$purpose] ?? 0), 2)])->all(),
            'chequesWaiting' => ['count' => (clone $waiting)->count(), 'amount' => round((float) (clone $waiting)->sum('amount'), 2)],
            'voided' => $this->wherePeriod($company->rentalPayments()->where('status', 'void'), 'paid_on', $range)->count(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return HasMany<RentalPayment, Company>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $this->wherePeriod($company->rentalPayments(), 'paid_on', $period)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('receipt_number', "%{$search}%")
                ->orWhereLike('reference', "%{$search}%")
                ->orWhereHas('rental', fn (Builder $rentals) => $rentals
                    ->whereLike('rental_number', "%{$search}%")
                    ->orWhereHas('client', fn (Builder $clients) => $clients->whereLike('name', "%{$search}%")))))
            ->when($except !== 'purpose' && $filters['purpose'] !== [], fn (Builder $query) => $query->whereIn('purpose', $filters['purpose']))
            ->when($except !== 'method' && $filters['method'] !== [], fn (Builder $query) => $query->whereIn('method', $filters['method']))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']));
    }

    private function purposeWord(string $purpose): string
    {
        return match ($purpose) {
            'deposit' => 'deposit',
            'other' => 'other charges',
            default => 'rent',
        };
    }
}
