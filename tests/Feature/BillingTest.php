<?php

use App\Models\Client;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Property;
use App\Models\User;
use Database\Seeders\ClientSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PropertySeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);

    $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->client = fn (string $name) => Client::where('name', $name)->sole();
    $this->contract = fn (string $number) => Contract::where('contract_number', $number)->sole();
});

/**
 * The client's single unpaid invoice from this month.
 */
function octoberInvoice(Client $client): Invoice
{
    return $client->invoices()->whereDate('period_start', '>=', '2026-10-01')->sole();
}

describe('invoices', function () {
    test('lists invoices with what is outstanding and overdue', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('invoices.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Invoices/Index')
                ->where('invoices.total', 50)
                ->where('summary.outstanding', 39500)
                ->where('summary.overdue.count', 4)
                ->where('summary.overdue.amount', 37800)
            );
    });

    test('narrows the list to overdue invoices', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('invoices.index', ['due' => ['overdue']]))
            ->assertInertia(fn (Assert $page) => $page->where('invoices.total', 4));
    });

    test('invoices the next billing period of a contract, without the deposit again', function () {
        $contract = ($this->contract)('CTR-2026-0001');

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.invoices.store', $contract))
            ->assertRedirect(route('invoices.show', Invoice::where('invoice_number', 'INV-2026-0051')->sole()));

        $invoice = Invoice::where('invoice_number', 'INV-2026-0051')->sole();

        expect($invoice->period_start->toDateString())->toBe('2026-11-01')
            ->and($invoice->period_end->toDateString())->toBe('2026-11-30')
            ->and((float) $invoice->total)->toBe(14700.0)
            ->and($invoice->status)->toBe('issued')
            ->and($invoice->items()->where('item_type', 'deposit')->exists())->toBeFalse()
            ->and($invoice->due_date->toDateString())->toBe('2026-10-24');
    });

    test('bills actual-use beds for the people who stayed', function () {
        $this->actingAs($this->superAdmin)->post(route('contracts.invoices.store', ($this->contract)('CTR-2026-0002')));

        $invoice = ($this->contract)('CTR-2026-0002')->invoices()->whereDate('period_start', '2026-11-01')->sole();

        expect($invoice->items()->orderBy('id')->pluck('quantity')->map(fn ($quantity) => (int) $quantity)->all())->toBe([3, 4])
            ->and((float) $invoice->total)->toBe(4200.0);
    });

    test('charges a line that starts mid-period only for its share of the month', function () {
        $alQuoz = Property::where('code', PropertySeeder::AL_QUOZ)->sole();
        $apartment = $alQuoz->apartments()->where('apartment_number', 'C-102')->sole();

        $this->actingAs($this->superAdmin)->post(route('contracts.store'), [
            'client_id' => ($this->client)(ClientSeeder::AL_NOOR)->id,
            'start_date' => '2026-11-01',
            'end_date' => '2027-10-31',
            'billing_cycle' => 'monthly',
            'payment_terms_days' => 7,
            'monthly_rent' => 3000,
            'lines' => [[
                'unit_type' => 'apartment', 'property_id' => $alQuoz->id, 'apartment_id' => $apartment->id,
                'start_date' => '2026-11-16', 'end_date' => '2027-10-31',
            ]],
        ])->assertSessionHasNoErrors();

        $contract = Contract::where('contract_number', 'CTR-2026-0012')->sole();
        $this->actingAs($this->superAdmin)->post(route('contracts.invoices.store', $contract));

        expect((float) $contract->invoices()->sole()->total)->toBe(1500.0);
    });

    test('a voided invoice\'s period can be billed again, but never twice', function () {
        $contract = ($this->contract)('CTR-2026-0001');
        $october = octoberInvoice(($this->client)(ClientSeeder::GULF_BUILDERS));

        $this->actingAs($this->superAdmin)->post(route('invoices.void', $october))->assertSessionHasNoErrors();
        expect($october->refresh()->status)->toBe('void');

        $this->actingAs($this->superAdmin)->post(route('contracts.invoices.store', $contract));

        expect($contract->invoices()->whereNot('status', 'void')->whereDate('period_start', '2026-10-01')->count())->toBe(1);
    });

    test('refuses to void an invoice that has payments', function () {
        $paid = ($this->client)(ClientSeeder::GULF_BUILDERS)->invoices()->where('status', 'paid')->first();

        $this->actingAs($this->superAdmin)->post(route('invoices.void', $paid))->assertSessionHasErrors('invoice');

        expect($paid->refresh()->status)->toBe('paid');
    });

    test('only invoices a running contract', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('contracts.invoices.store', ($this->contract)('CTR-2026-0010')))
            ->assertSessionHasErrors('invoice');
    });

    test('shows an invoice with its items and payments', function () {
        $invoice = Invoice::where('invoice_number', 'INV-2026-0001')->sole();

        $this->actingAs($this->superAdmin)
            ->get(route('invoices.show', $invoice))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Invoices/Show')
                ->where('invoice.total', 24700)
                ->has('items', 4)
                ->has('allocations', 1)
                ->where('invoice.canVoid', false)
            );
    });
});

describe('payments', function () {
    test('records a payment and settles the invoice it is allocated to', function () {
        $brew = ($this->client)(ClientSeeder::BREW_CORNER);
        $invoice = octoberInvoice($brew);

        $this->actingAs($this->superAdmin)
            ->post(route('payments.store'), [
                'client_id' => $brew->id,
                'received_on' => '2026-10-17',
                'amount' => 5880,
                'method' => 'bank_transfer',
                'reference' => 'TRF-5520',
                'allocations' => [['invoice_id' => $invoice->id, 'amount' => 5880]],
            ])
            ->assertSessionHasNoErrors();

        $payment = Payment::where('payment_number', 'RCPT-2026-0048')->sole();

        expect($payment->status)->toBe('cleared')
            ->and($invoice->refresh()->status)->toBe('paid')
            ->and($brew->outstandingBalance())->toBe(0.0);
    });

    test('a cheque only counts once it clears', function () {
        $freshFold = ($this->client)(ClientSeeder::FRESHFOLD);
        $invoice = $freshFold->invoices()->where('status', 'issued')->sole();

        $this->actingAs($this->superAdmin)->post(route('payments.store'), [
            'client_id' => $freshFold->id,
            'received_on' => '2026-10-17',
            'amount' => 15120,
            'method' => 'cheque',
            'status' => 'pending',
            'cheque_number' => '700999',
            'cheque_date' => '2026-10-25',
            'allocations' => [['invoice_id' => $invoice->id, 'amount' => 15120]],
        ])->assertSessionHasNoErrors();

        $payment = Payment::where('payment_number', 'RCPT-2026-0048')->sole();
        expect($invoice->refresh()->status)->toBe('issued');

        $this->actingAs($this->superAdmin)->patch(route('payments.update', $payment), ['status' => 'cleared'])->assertSessionHasNoErrors();
        expect($invoice->refresh()->status)->toBe('paid');
    });

    test('a bounced cheque reopens its invoice', function () {
        $daniel = ($this->client)(ClientSeeder::DANIEL);
        $september = $daniel->invoices()->whereDate('period_start', '2026-09-15')->sole();
        $payment = $september->allocations()->sole()->payment;

        $this->actingAs($this->superAdmin)->patch(route('payments.update', $payment), ['status' => 'bounced'])->assertSessionHasNoErrors();

        expect($september->refresh()->status)->toBe('issued')
            ->and((float) $september->amount_paid)->toBe(0.0);
    });

    test('refuses allocations that do not fit', function (Closure $input, string $field) {
        $this->actingAs($this->superAdmin)
            ->post(route('payments.store'), $input->call($this))
            ->assertSessionHasErrors($field);

        expect(Payment::count())->toBe(47);
    })->with([
        'more than the invoice owes' => [function () {
            $brew = ($this->client)(ClientSeeder::BREW_CORNER);

            return ['client_id' => $brew->id, 'received_on' => '2026-10-17', 'amount' => 6000, 'method' => 'cash',
                'allocations' => [['invoice_id' => octoberInvoice($brew)->id, 'amount' => 6000]]];
        }, 'allocations.0.amount'],
        'more than the payment' => [function () {
            $brew = ($this->client)(ClientSeeder::BREW_CORNER);

            return ['client_id' => $brew->id, 'received_on' => '2026-10-17', 'amount' => 100, 'method' => 'cash',
                'allocations' => [['invoice_id' => octoberInvoice($brew)->id, 'amount' => 200]]];
        }, 'amount'],
        'another client\'s invoice' => [function () {
            return ['client_id' => ($this->client)(ClientSeeder::BREW_CORNER)->id, 'received_on' => '2026-10-17', 'amount' => 100, 'method' => 'cash',
                'allocations' => [['invoice_id' => octoberInvoice(($this->client)(ClientSeeder::GULF_BUILDERS))->id, 'amount' => 100]]];
        }, 'allocations.0.invoice_id'],
        'a cheque without its number' => [function () {
            return ['client_id' => ($this->client)(ClientSeeder::BREW_CORNER)->id, 'received_on' => '2026-10-17', 'amount' => 100, 'method' => 'cheque', 'status' => 'pending'];
        }, 'cheque_number'],
    ]);

    test('only a cheque can change status', function () {
        $transfer = Payment::where('method', 'bank_transfer')->first();

        $this->actingAs($this->superAdmin)->patch(route('payments.update', $transfer), ['status' => 'bounced'])->assertSessionHasErrors('status');

        expect($transfer->refresh()->status)->toBe('cleared');
    });

    test('the payment form loads the chosen client\'s open invoices', function () {
        $gulf = ($this->client)(ClientSeeder::GULF_BUILDERS);
        $october = octoberInvoice($gulf);

        $this->actingAs($this->superAdmin)
            ->get(route('payments.create', ['client' => $gulf->id, 'invoice' => $october->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Payments/Form')
                ->where('clientId', $gulf->id)
                ->where('invoiceId', $october->id)
                ->has('openInvoices', 1)
                ->where('openInvoices.0.balance', 14700)
            );
    });

    test('lists payments with cheques waiting and bounced', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('payments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Payments/Index')
                ->where('payments.total', 47)
                ->where('summary.pending.count', 1)
                ->where('summary.bounced.count', 1)
            );
    });

    test('hides other companies\' invoices and payments', function () {
        $otherContract = Contract::factory()->active()->create();

        $this->actingAs($this->superAdmin)->post(route('contracts.invoices.store', $otherContract))->assertNotFound();
    });
});
