<?php

use App\Models\Apartment;
use App\Models\Client;
use App\Models\Commission;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Deposit;
use App\Models\ExtraIncome;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Property;
use App\Models\RentalPayment;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\Settlement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));

    $this->property = Property::factory()->create(['name' => 'Al Quoz Camp']);
    $this->companyId = $this->property->company_id;
    $this->user = User::factory()->create(['company_id' => $this->companyId]);
    $this->client = Client::factory()->create(['company_id' => $this->companyId, 'name' => 'Al Hajar Contracting']);
    $this->apartment = Apartment::factory()->create(['property_id' => $this->property->id]);
    $this->room = Room::factory()->create(['property_id' => $this->property->id]);
});

/**
 * A year's contract for one apartment at 4,000 a month.
 *
 * @return array<string, mixed>
 */
function extraPaymentContract(array $overrides = []): array
{
    return [
        'client_mode' => 'existing',
        'client_id' => test()->client->id,
        'start_date' => '2026-11-01',
        'end_date' => '2027-10-31',
        'billing_cycle' => 'monthly',
        'payment_terms_days' => 7,
        'monthly_rent' => 4000,
        'lines' => [['unit_type' => 'apartment', 'property_id' => test()->property->id, 'apartment_id' => test()->apartment->id]],
        ...$overrides,
    ];
}

/**
 * A short-term rental of one room at 2,000 a month.
 *
 * @return array<string, mixed>
 */
function extraPaymentRental(array $overrides = []): array
{
    return [
        'client_mode' => 'existing',
        'client_id' => test()->client->id,
        'property_id' => test()->property->id,
        'room_ids' => [test()->room->id],
        'start_date' => '2026-10-01',
        'monthly_rent' => 2000,
        'first_payment' => 'later',
        ...$overrides,
    ];
}

/**
 * A commission received in cash, for `$amount`, at the test property.
 */
function receivedCommission(float $amount = 1000, array $attributes = []): Commission
{
    return Commission::factory()->create([
        'client_id' => test()->client->id,
        'property_id' => test()->property->id,
        'amount' => $amount,
        'received_on' => '2026-10-10',
        ...$attributes,
    ]);
}

/**
 * @return array<string, mixed>
 */
function settlementInput(array $overrides = []): array
{
    return ['settled_on' => '2026-10-15', 'amount' => 400, 'paid_to' => 'Sales agent', 'method' => 'cash', ...$overrides];
}

/**
 * An invoice of `$rent` plus a deposit, paid by a receipt for `$paid`, as
 * they were saved before deposits moved out of invoices.
 */
function invoiceWithDeposit(Contract $contract, float $rent, float $deposit, float $paid): Invoice
{
    $total = $rent + $deposit;
    $invoiceId = DB::table('invoices')->insertGetId([
        'company_id' => $contract->company_id,
        'contract_id' => $contract->id,
        'client_id' => $contract->client_id,
        'invoice_number' => 'INV-2026-0001',
        'issue_date' => '2026-09-01',
        'due_date' => '2026-09-08',
        'period_start' => '2026-09-01',
        'period_end' => '2026-09-30',
        'subtotal' => $total,
        'total' => $total,
        'amount_paid' => $paid,
        'status' => $paid >= $total ? 'paid' : 'partially_paid',
    ]);
    DB::table('invoice_items')->insert(['invoice_id' => $invoiceId, 'item_type' => 'rent', 'description' => 'Rent', 'quantity' => 1, 'unit_price' => $rent, 'amount' => $rent]);
    DB::table('invoice_items')->insert(['invoice_id' => $invoiceId, 'item_type' => 'deposit', 'description' => 'Security deposit', 'quantity' => 1, 'unit_price' => $deposit, 'amount' => $deposit]);
    $paymentId = DB::table('payments')->insertGetId([
        'company_id' => $contract->company_id,
        'client_id' => $contract->client_id,
        'payment_number' => 'RCPT-2026-0001',
        'received_on' => '2026-09-03',
        'amount' => $paid,
        'method' => 'bank_transfer',
        'status' => 'cleared',
    ]);
    DB::table('payment_allocations')->insert(['client_id' => $contract->client_id, 'payment_id' => $paymentId, 'invoice_id' => $invoiceId, 'amount' => $paid]);

    return Invoice::query()->findOrFail($invoiceId);
}

describe('taking a commission and a deposit with a contract', function () {
    test('works a percentage out on the rent for the whole term', function () {
        $this->actingAs($this->user)
            ->post(route('contracts.store'), extraPaymentContract(['commission_type' => 'percentage', 'commission_rate' => 5, 'commission_payment' => 'cash']))
            ->assertSessionHasNoErrors();

        $commission = Commission::query()->sole();

        expect((float) $commission->amount)->toBe(2400.0)
            ->and((float) $commission->rate)->toBe(5.0)
            ->and($commission->status)->toBe('received')
            ->and($commission->method)->toBe('cash')
            ->and($commission->received_on->toDateString())->toBe('2026-10-17')
            ->and($commission->property_id)->toBe($this->property->id)
            ->and($commission->client_id)->toBe($this->client->id);
    });

    test('takes an exact amount, and a deposit by cheque with its details', function () {
        $this->actingAs($this->user)
            ->post(route('contracts.store'), extraPaymentContract([
                'commission_type' => 'amount',
                'commission_amount' => 1500,
                'commission_payment' => 'later',
                'security_deposit' => 4000,
                'deposit_payment' => 'cheque',
                'deposit_cheque_number' => '001234',
                'deposit_bank_name' => 'Emirates NBD',
                'deposit_cheque_date' => '2026-11-01',
            ]))
            ->assertSessionHasNoErrors();

        $deposit = Deposit::query()->sole();

        expect((float) Commission::query()->sole()->amount)->toBe(1500.0)
            ->and(Commission::query()->sole()->rate)->toBeNull()
            ->and(Commission::query()->sole()->status)->toBe('pending')
            ->and((float) $deposit->amount)->toBe(4000.0)
            ->and($deposit->method)->toBe('cheque')
            ->and($deposit->cheque_number)->toBe('001234')
            ->and($deposit->bank_name)->toBe('Emirates NBD');
    });

    test('needs a cheque\'s details, and a percentage or amount for the kind chosen', function (array $input, string $field) {
        $this->actingAs($this->user)
            ->post(route('contracts.store'), extraPaymentContract($input))
            ->assertSessionHasErrors($field);

        expect(Commission::query()->count())->toBe(0);
    })->with([
        'percentage' => [['commission_type' => 'percentage'], 'commission_rate'],
        'over 100%' => [['commission_type' => 'percentage', 'commission_rate' => 101], 'commission_rate'],
        'amount' => [['commission_type' => 'amount'], 'commission_amount'],
        'commission cheque' => [['commission_type' => 'amount', 'commission_amount' => 100, 'commission_payment' => 'cheque'], 'commission_cheque_number'],
        'deposit cheque' => [['security_deposit' => 100, 'deposit_payment' => 'cheque'], 'deposit_bank_name'],
    ]);

    test('keeps the deposit out of the contract\'s cheques and its first invoice', function () {
        $this->actingAs($this->user)
            ->post(route('contracts.store'), extraPaymentContract(['security_deposit' => 4000, 'deposit_payment' => 'cash']))
            ->assertSessionHasNoErrors();

        $contract = Contract::query()->sole();
        $invoice = $contract->generateNextInvoice($contract->start_date);

        expect($contract->cheques()->count())->toBe(12)
            ->and($contract->cheques()->where('purpose', 'security_deposit')->exists())->toBeFalse()
            ->and((float) $invoice->total)->toBe(4000.0)
            ->and($invoice->items()->where('item_type', 'deposit')->exists())->toBeFalse();
    });

    test('follows a change of rent, and removes a commission taken off the form', function () {
        $this->actingAs($this->user)->post(route('contracts.store'), extraPaymentContract(['commission_type' => 'percentage', 'commission_rate' => 5, 'commission_payment' => 'later']));
        $contract = Contract::query()->sole();
        $line = $contract->lines()->sole();
        $lines = [['id' => $line->id, 'unit_type' => 'apartment', 'property_id' => $this->property->id, 'apartment_id' => $this->apartment->id]];

        $this->actingAs($this->user)
            ->put(route('contracts.update', $contract), extraPaymentContract(['monthly_rent' => 5000, 'lines' => $lines, 'commission_type' => 'percentage', 'commission_rate' => 5, 'commission_payment' => 'later']))
            ->assertSessionHasNoErrors();

        expect((float) Commission::query()->sole()->amount)->toBe(3000.0);

        $this->actingAs($this->user)
            ->put(route('contracts.update', $contract), extraPaymentContract(['lines' => $lines, 'commission_type' => 'none']))
            ->assertSessionHasNoErrors();

        expect(Commission::query()->count())->toBe(0);
    });

    test('will not take a commission below what has been settled', function () {
        $this->actingAs($this->user)->post(route('contracts.store'), extraPaymentContract(['commission_type' => 'amount', 'commission_amount' => 1000, 'commission_payment' => 'cash']));
        $contract = Contract::query()->sole();
        Commission::query()->sole()->settle(settlementInput(['amount' => 600]));
        $lines = [['id' => $contract->lines()->sole()->id, 'unit_type' => 'apartment', 'property_id' => $this->property->id, 'apartment_id' => $this->apartment->id]];

        $this->actingAs($this->user)
            ->put(route('contracts.update', $contract), extraPaymentContract(['lines' => $lines, 'commission_type' => 'amount', 'commission_amount' => 500, 'commission_payment' => 'cash']))
            ->assertSessionHasErrors('commission_amount');

        expect((float) Commission::query()->sole()->amount)->toBe(1000.0);
    });
});

describe('taking a commission and a deposit with a short-term rental', function () {
    test('works a percentage out on the monthly rent, as a rental has no term', function () {
        $this->actingAs($this->user)
            ->post(route('rentals.store'), extraPaymentRental(['commission_type' => 'percentage', 'commission_rate' => 10, 'commission_payment' => 'cash']))
            ->assertSessionHasNoErrors();

        expect((float) Commission::query()->sole()->amount)->toBe(200.0)
            ->and(Commission::query()->sole()->agreement)->toBeInstanceOf(RoomRental::class);
    });

    test('records the deposit apart from the rent, with no receipt or cheque', function () {
        $this->actingAs($this->user)
            ->post(route('rentals.store'), extraPaymentRental(['security_deposit' => 2000, 'deposit_payment' => 'cash', 'first_payment' => 'now', 'payment_method' => 'cash']))
            ->assertSessionHasNoErrors();

        $rental = RoomRental::query()->sole();

        expect((float) Deposit::query()->sole()->amount)->toBe(2000.0)
            ->and($rental->payments()->sole()->purpose)->toBe('rent')
            ->and((float) $rental->payments()->sum('amount'))->toBe(2000.0)
            ->and($rental->cheques()->count())->toBe(0);
    });

    test('hands the deposit back as a settlement when the tenant moves out', function () {
        $this->actingAs($this->user)->post(route('rentals.store'), extraPaymentRental(['security_deposit' => 2000, 'deposit_payment' => 'cash']));
        $rental = RoomRental::query()->sole();

        $this->actingAs($this->user)
            ->post(route('rentals.end', $rental), ['moved_out_on' => '2026-10-16', 'deposit_refunded' => 1500, 'deposit_refund_method' => 'cash'])
            ->assertSessionHasNoErrors();

        $deposit = Deposit::query()->sole();

        expect((float) $deposit->settled_amount)->toBe(1500.0)
            ->and($deposit->remaining())->toBe(500.0)
            ->and($deposit->settlements()->sole()->paid_to)->toBe('Al Hajar Contracting');
    });

    test('will not hand back more of the deposit than is held', function () {
        $this->actingAs($this->user)->post(route('rentals.store'), extraPaymentRental(['security_deposit' => 2000, 'deposit_payment' => 'later']));

        $this->actingAs($this->user)
            ->post(route('rentals.end', RoomRental::query()->sole()), ['moved_out_on' => '2026-10-16', 'deposit_refunded' => 100, 'deposit_refund_method' => 'cash'])
            ->assertSessionHasErrors('deposit_refunded');

        expect(RoomRental::query()->sole()->status)->toBe('active');
    });
});

describe('settling', function () {
    test('pays out in parts and keeps what is left', function () {
        $commission = receivedCommission();

        $this->actingAs($this->user)->post(route('commissions.settlements.store', $commission), settlementInput(['reference' => 'TT-991', 'notes' => 'Agent fee']))->assertSessionHasNoErrors();
        $this->actingAs($this->user)->post(route('commissions.settlements.store', $commission), settlementInput(['amount' => 600, 'method' => 'bank_transfer']))->assertSessionHasNoErrors();

        $commission->refresh();

        expect((float) $commission->settled_amount)->toBe(1000.0)
            ->and($commission->remaining())->toBe(0.0)
            ->and($commission->standing())->toBe('settled')
            ->and($commission->settlements()->count())->toBe(2)
            ->and($commission->settlements()->first()->created_by)->toBe($this->user->id);
    });

    test('works the same on deposits and extra income', function (string $routeName, Closure $record) {
        $settleable = $record();

        $this->actingAs($this->user)->post(route($routeName, $settleable), settlementInput())->assertSessionHasNoErrors();

        expect((float) $settleable->refresh()->settled_amount)->toBe(400.0)
            ->and($settleable->standing())->toBe('part_settled');
    })->with([
        'deposit' => ['deposits.settlements.store', fn () => Deposit::factory()->create(['client_id' => test()->client->id, 'property_id' => test()->property->id, 'amount' => 1000, 'received_on' => '2026-10-10'])],
        'extra income' => ['extra-incomes.settlements.store', fn () => ExtraIncome::factory()->create(['property_id' => test()->property->id, 'amount' => 1000, 'received_on' => '2026-10-10'])],
    ]);

    test('refuses more than is left, a future date, a date before the money came, and money not received', function (array $input, array $attributes, string $field) {
        $commission = receivedCommission(1000, $attributes);

        $this->actingAs($this->user)
            ->post(route('commissions.settlements.store', $commission), settlementInput($input))
            ->assertSessionHasErrors($field);

        expect($commission->settlements()->count())->toBe(0);
    })->with([
        'too much' => [['amount' => 1000.01], [], 'amount'],
        'future date' => [['settled_on' => '2026-10-18'], [], 'settled_on'],
        'before it came' => [['settled_on' => '2026-10-09'], [], 'settled_on'],
        'nobody paid' => [['paid_to' => ''], [], 'paid_to'],
        'still pending' => [[], ['status' => 'pending', 'received_on' => null, 'method' => null], 'amount'],
        'cancelled' => [[], ['status' => 'cancelled'], 'amount'],
    ]);

    test('takes a settlement back, returning the money to what is in hand', function () {
        $commission = receivedCommission();
        $settlement = $commission->settle(settlementInput());

        $this->actingAs($this->user)
            ->delete(route('commissions.settlements.destroy', ['record' => $commission->id, 'settlement' => $settlement->id]))
            ->assertSessionHasNoErrors();

        expect(Settlement::query()->count())->toBe(0)
            ->and((float) $commission->refresh()->settled_amount)->toBe(0.0)
            ->and($commission->standing())->toBe('held');
    });

    test('does not reach a settlement through another record', function () {
        $other = receivedCommission(500)->settle(settlementInput());

        $this->actingAs($this->user)
            ->delete(route('commissions.settlements.destroy', ['record' => receivedCommission(900, ['agreement_id' => 9999])->id, 'settlement' => $other->id]))
            ->assertNotFound();

        expect(Settlement::query()->count())->toBe(1);
    });

    test('marks money left for later as received, by cash or a cheque with its details', function () {
        $commission = receivedCommission(1000, ['status' => 'pending', 'received_on' => null, 'method' => null]);

        $this->actingAs($this->user)
            ->post(route('commissions.receive', $commission), ['received_on' => '2026-10-16', 'method' => 'cheque'])
            ->assertSessionHasErrors(['cheque_number', 'bank_name', 'cheque_date']);

        $this->actingAs($this->user)
            ->post(route('commissions.receive', $commission), ['received_on' => '2026-10-16', 'method' => 'cheque', 'cheque_number' => '5512', 'bank_name' => 'ADCB', 'cheque_date' => '2026-10-16'])
            ->assertSessionHasNoErrors();

        expect($commission->refresh()->status)->toBe('received')
            ->and($commission->received_on->toDateString())->toBe('2026-10-16')
            ->and($commission->cheque_number)->toBe('5512');
    });

    test('cancels money that will not be paid, unless some has been settled', function () {
        $settled = receivedCommission();
        $settled->settle(settlementInput());
        $pending = receivedCommission(800, ['status' => 'pending', 'received_on' => null, 'method' => null, 'agreement_id' => 9999]);

        $this->actingAs($this->user)->post(route('commissions.status', $settled), ['cancelled' => true])->assertSessionHasErrors('status');
        $this->actingAs($this->user)->post(route('commissions.status', $pending), ['cancelled' => true])->assertSessionHasNoErrors();

        expect($settled->refresh()->status)->toBe('received')
            ->and($pending->refresh()->status)->toBe('cancelled');

        $this->actingAs($this->user)->post(route('commissions.status', $pending), ['cancelled' => false])->assertSessionHasNoErrors();

        expect($pending->refresh()->status)->toBe('pending');
    });

    test('will not cancel extra income with settlements, or correct it below them', function () {
        $income = ExtraIncome::factory()->create(['property_id' => $this->property->id, 'amount' => 1000, 'received_on' => '2026-10-10']);
        $income->settle(settlementInput(['amount' => 700]));

        $this->actingAs($this->user)->post(route('extra-incomes.status', $income), ['status' => 'cancelled'])->assertSessionHasErrors('status');
        $this->actingAs($this->user)
            ->put(route('extra-incomes.update', $income), ['property_id' => $this->property->id, 'title' => 'Internet', 'received_from' => 'Fibre', 'amount' => 600, 'received_on' => '2026-10-10', 'method' => 'cash'])
            ->assertSessionHasErrors('amount');

        expect($income->refresh()->status)->toBe('received')
            ->and((float) $income->amount)->toBe(1000.0);
    });
});

describe('the overview and lists', function () {
    beforeEach(function () {
        $this->otherProperty = Property::factory()->create(['company_id' => $this->companyId, 'name' => 'Jebel Ali Camp']);
        $settled = receivedCommission();
        $settled->settle(settlementInput(['amount' => 1000, 'paid_to' => 'Sales agent', 'notes' => 'Agent fee']));
        receivedCommission(600, ['agreement_id' => 9001, 'property_id' => $this->otherProperty->id, 'received_on' => '2026-08-05']);
        receivedCommission(250, ['agreement_id' => 9002, 'status' => 'pending', 'received_on' => null, 'method' => null]);
        receivedCommission(9000, ['agreement_id' => 9003, 'status' => 'cancelled']);
        Deposit::factory()->create(['client_id' => $this->client->id, 'property_id' => $this->property->id, 'amount' => 4000, 'received_on' => '2026-10-02']);
        ExtraIncome::factory()->create(['property_id' => $this->property->id, 'amount' => 2500, 'received_on' => '2026-10-12']);
    });

    test('adds up what came in, what was settled and how, and what is left', function () {
        $this->actingAs($this->user)
            ->get(route('extra-payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('ExtraPayments/Overview')
                ->where('commissions.figures.received', 1600)
                ->where('commissions.figures.settled', 1000)
                ->where('commissions.figures.settledCount', 1)
                ->where('commissions.figures.remaining', 600)
                ->where('commissions.figures.toCollect', 250)
                ->where('deposits.figures.remaining', 4000)
                ->where('extraIncome.figures.remaining', 2500)
                ->where('settlements.count', 1)
                ->where('settlements.rows.0.paidTo', 'Sales agent')
                ->where('settlements.rows.0.notes', 'Agent fee')
                ->where('settlements.rows.0.kind', 'commission')
                ->where('settlements.rows.0.property.name', 'Al Quoz Camp')
            );
    });

    test('filters by period, keeping what is still to arrive', function () {
        $this->actingAs($this->user)
            ->get(route('extra-payments.index', ['period' => '2026-08']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('commissions.figures.received', 600)
                ->where('commissions.figures.toCollect', 250)
                ->where('deposits.figures.received', 0)
                ->where('settlements.count', 0)
            );
    });

    test('filters by property and by how the money stands', function () {
        $this->actingAs($this->user)
            ->get(route('extra-payments.index', ['property' => $this->otherProperty->id]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('commissions.figures.received', 600)
                ->where('deposits.figures.received', 0)
                ->where('extraIncome.figures.received', 0)
            );

        $this->actingAs($this->user)
            ->get(route('extra-payments.index', ['standing' => ['settled']]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('commissions.figures.received', 1000)
                ->where('deposits.figures.received', 0)
            );
    });

    test('lists each kind on its own page with a Manage row', function () {
        $this->actingAs($this->user)
            ->get(route('commissions.index', ['standing' => ['held']]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('ExtraPayments/Records')
                ->where('kind', 'commission')
                ->has('records.data', 1)
                ->where('records.data.0.remaining', 600)
                ->where('records.data.0.standing', 'held')
            );

        $this->actingAs($this->user)
            ->get(route('deposits.index'))
            ->assertInertia(fn (Assert $page) => $page->where('kind', 'deposit')->has('records.data', 1)->where('summary.remaining', 4000));

        $this->actingAs($this->user)
            ->get(route('extra-incomes.index'))
            ->assertInertia(fn (Assert $page) => $page->component('ExtraIncome/Index')->has('incomes.data', 1)->where('summary.remaining', 2500)->where('incomes.data.0.kind', 'extra_income'));
    });

    test('shows nothing of another company', function () {
        $stranger = User::factory()->create(['company_id' => Property::factory()->create()->company_id]);
        $commission = Commission::query()->first();

        $this->actingAs($stranger)->get(route('extra-payments.index'))->assertInertia(fn (Assert $page) => $page->where('commissions.figures.received', 0));
        $this->actingAs($stranger)->post(route('commissions.settlements.store', $commission), settlementInput(['amount' => 1]))->assertNotFound();
        $this->actingAs($stranger)->post(route('commissions.status', $commission), ['cancelled' => true])->assertNotFound();
    });
});

describe('keeping it out of the main books', function () {
    beforeEach(function () {
        receivedCommission(1000);
        Deposit::factory()->create(['client_id' => $this->client->id, 'property_id' => $this->property->id, 'amount' => 4000, 'received_on' => '2026-10-10']);
        ExtraIncome::factory()->create(['property_id' => $this->property->id, 'amount' => 2500, 'received_on' => '2026-10-10']);
    });

    test('is not money in or out on the payments overview', function () {
        Settlement::factory()->create(['settleable_id' => ExtraIncome::query()->sole()->id, 'amount' => 500, 'settled_on' => '2026-10-11']);

        $this->actingAs($this->user)
            ->get(route('payments.overview', ['period' => 'all']))
            ->assertInertia(fn (Assert $page) => $page
                ->missing('totals.extra_income')
                ->missing('totals.deposit_refund')
                ->has('transactions.data', 0)
            );
    });

    test('is not on the property\'s payments', function () {
        $this->actingAs($this->user)
            ->get(route('properties.payments', $this->property))
            ->assertInertia(fn (Assert $page) => $page->missing('incoming.extraIncome')->missing('summary.extraIncome'));
    });

    test('is not revenue on the analyze page', function () {
        $this->actingAs($this->user)
            ->get(route('analyze'))
            ->assertInertia(fn (Assert $page) => $page->where('totals.revenue', 0)->missing('totals.sources.extra_income'));
    });

    test('is not income on the reports', function () {
        $this->actingAs($this->user)
            ->get(route('reports.income', ['period' => 'all']))
            ->assertInertia(fn (Assert $page) => $page->missing('statement.extra_income')->missing('statement.deposit_refund')->has('payers', 0));
    });
});

describe('moving existing deposits', function () {
    beforeEach(function () {
        $this->migration = require database_path('migrations/2026_11_04_184804_move_deposits_to_extra_payments.php');
        $this->migration->down();
        $this->contract = Contract::factory()->active()->create(['client_id' => $this->client->id, 'security_deposit' => 4000]);
        ContractLine::factory()->create(['contract_id' => $this->contract->id, 'property_id' => $this->property->id, 'monthly_rate' => 3000]);
    });

    test('takes the deposit off the invoice and the receipt that paid it, so it is not counted twice', function () {
        $invoice = invoiceWithDeposit($this->contract, 3000, 4000, 7000);

        $this->migration->up();

        $deposit = Deposit::query()->sole();
        $invoice->refresh();

        expect((float) $invoice->total)->toBe(3000.0)
            ->and((float) $invoice->amount_paid)->toBe(3000.0)
            ->and($invoice->status)->toBe('paid')
            ->and((float) Payment::query()->sole()->amount)->toBe(3000.0)
            ->and((float) DB::table('payment_allocations')->sole()->amount)->toBe(3000.0)
            ->and((float) $deposit->amount)->toBe(4000.0)
            ->and($deposit->status)->toBe('received')
            ->and($deposit->method)->toBe('bank_transfer')
            ->and($deposit->received_on->toDateString())->toBe('2026-09-03');
    });

    test('leaves an unpaid deposit waiting, and rent paid so far untouched', function () {
        $invoice = invoiceWithDeposit($this->contract, 3000, 4000, 1000);

        $this->migration->up();

        expect(Deposit::query()->sole()->status)->toBe('pending')
            ->and((float) Payment::query()->sole()->amount)->toBe(1000.0)
            ->and($invoice->refresh()->status)->toBe('partially_paid');
    });

    test('moves a rental\'s deposit receipts and refund', function () {
        $rental = RoomRental::factory()->forRooms($this->room)->create(['client_id' => $this->client->id, 'security_deposit' => 2000, 'status' => 'ended', 'moved_out_on' => '2026-10-10', 'deposit_refunded' => 1500, 'deposit_refunded_on' => '2026-10-10', 'deposit_refund_method' => 'cash']);
        DB::table('rental_payments')->insert(['company_id' => $rental->company_id, 'room_rental_id' => $rental->id, 'receipt_number' => 'RR-2026-0001', 'paid_on' => '2026-09-01', 'amount' => 2000, 'purpose' => 'deposit', 'method' => 'cash']);

        $this->migration->up();

        $deposit = Deposit::query()->where('agreement_type', 'room_rental')->sole();

        expect((float) $deposit->amount)->toBe(2000.0)
            ->and((float) $deposit->settled_amount)->toBe(1500.0)
            ->and($deposit->settlements()->sole()->paid_to)->toBe('Al Hajar Contracting')
            ->and(RentalPayment::query()->sole()->status)->toBe('void');
    });
});
