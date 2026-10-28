<?php

use App\Models\Cheque;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\HeadLease;
use App\Models\OtherPayment;
use App\Models\Property;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));

    $this->property = Property::factory()->create();
    $this->user = User::factory()->create(['company_id' => $this->property->company_id]);
    $this->payment = fn (array $attributes = []) => [
        'property_id' => $this->property->id,
        'status' => 'paid',
        'title' => 'Civil Defence permit renewal',
        'paid_to' => 'Dubai Civil Defence',
        'amount' => 1250,
        'payment_date' => '2026-10-17',
        'method' => 'bank_transfer',
        'reference' => 'TRF-55120',
        ...$attributes,
    ];
    $this->setStatus = fn (OtherPayment $payment, array $data) => $this->actingAs($this->user)
        ->from(route('properties.payments', $this->property))
        ->post(route('other-payments.status', $payment), $data);
});

test('adds a payment made now for a property, listed on its payments and in the cash ledger', function () {
    Storage::fake('local');

    $this->actingAs($this->user)
        ->get(route('other-payments.create', ['property' => $this->property->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('OtherPayments/Form')
            ->where('defaults.property_id', $this->property->id)
        );

    $this->actingAs($this->user)
        ->post(route('other-payments.store'), ($this->payment)(['receipt' => UploadedFile::fake()->create('receipt.pdf', 120, 'application/pdf')]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('properties.payments', ['property' => $this->property, 'tab' => 'out']));

    $payment = OtherPayment::query()->sole();

    expect($payment->payment_number)->toBe('OP-2026-0001')
        ->and($payment->status)->toBe('paid')
        ->and($payment->paid_by)->toBe($this->user->id)
        ->and($payment->receipt_name)->toBe('receipt.pdf');
    Storage::disk('local')->assertExists($payment->receipt_path);

    $this->actingAs($this->user)
        ->get(route('properties.payments', ['property' => $this->property, 'tab' => 'out']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('outgoing.others', 1)
            ->where('outgoing.others.0.number', 'OP-2026-0001')
            ->where('outgoing.others.0.paidTo', 'Dubai Civil Defence')
            ->where('summary.paidOut', 1250)
        );

    $this->actingAs($this->user)
        ->get(route('payments.overview'))
        ->assertInertia(fn (Assert $page) => $page->where('totals.other_payment', ['count' => 1, 'amount' => 1250]));
});

test('a payment made now needs how it was paid, on a day not after today', function () {
    $this->actingAs($this->user)
        ->post(route('other-payments.store'), ($this->payment)(['method' => null, 'payment_date' => '2026-10-20']))
        ->assertSessionHasErrors(['method', 'payment_date']);

    // One to pay later can fall due ahead, and is not paid yet.
    $this->actingAs($this->user)
        ->post(route('other-payments.store'), ($this->payment)(['status' => 'pending', 'method' => null, 'payment_date' => '2026-10-25']))
        ->assertSessionHasNoErrors();

    expect(OtherPayment::query()->sole()->status)->toBe('pending');
});

test('a payment to pay is paid, put back to pay or cancelled, counting as money out only while paid', function () {
    $payment = OtherPayment::factory()->create(['property_id' => $this->property->id, 'amount' => 400, 'payment_date' => '2026-10-10']);

    $this->actingAs($this->user)
        ->get(route('properties.payments', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->where('outgoing.others.0.isOverdue', true)
            ->where('summary.toPay', 400)
            ->where('summary.paidOut', 0)
        );

    ($this->setStatus)($payment, ['status' => 'paid'])->assertSessionHasErrors(['date', 'method']);
    ($this->setStatus)($payment, ['status' => 'paid', 'date' => '2026-10-16', 'method' => 'cash'])->assertSessionHasNoErrors();

    expect($payment->fresh())
        ->status->toBe('paid')
        ->payment_date->toDateString()->toBe('2026-10-16')
        ->method->toBe('cash');

    ($this->setStatus)($payment, ['status' => 'pending'])->assertSessionHasNoErrors();
    expect($payment->fresh()->status)->toBe('pending');

    ($this->setStatus)($payment, ['status' => 'cancelled'])->assertSessionHasNoErrors();
    ($this->setStatus)($payment, ['status' => 'cancelled'])->assertSessionHasErrors('status');

    $this->actingAs($this->user)
        ->get(route('properties.payments', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->where('outgoing.others.0.status', 'cancelled')
            ->where('summary.toPay', 0)
            ->where('summary.paidOut', 0)
        );
});

test('corrects a payment on its form', function () {
    $payment = OtherPayment::factory()->paid()->create(['property_id' => $this->property->id]);

    $this->actingAs($this->user)
        ->get(route('other-payments.edit', $payment))
        ->assertInertia(fn (Assert $page) => $page->where('payment.number', $payment->payment_number));

    $this->actingAs($this->user)
        ->put(route('other-payments.update', $payment), ($this->payment)(['amount' => 980]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('properties.payments', ['property' => $this->property, 'tab' => 'out']));

    expect((float) $payment->fresh()->amount)->toBe(980.0)
        ->and($payment->fresh()->status)->toBe('paid');
});

test('marks a client cheque in hand as cashed in one step, recording the client’s payment', function () {
    $contract = Contract::factory()->active()->create([
        'client_id' => Client::factory()->create(['company_id' => $this->property->company_id])->id,
        'start_date' => '2026-10-01',
        'end_date' => '2027-09-30',
    ]);
    $room = Room::factory()->create(['property_id' => $this->property->id, 'capacity' => 4, 'occupied_count' => 0]);
    ContractLine::factory()->create(['contract_id' => $contract->id, 'property_id' => $this->property->id, 'unit_type' => 'room', 'room_id' => $room->id, 'quantity' => 1, 'monthly_rate' => 2000]);
    $cheque = Cheque::factory()->forAgreement($contract)->held()->create(['cheque_date' => '2026-10-01', 'amount' => 2000, 'period_start' => '2026-10-01', 'period_end' => '2026-10-31']);

    $this->actingAs($this->user)
        ->from(route('properties.payments', $this->property))
        ->post(route('cheques.settle', $cheque), ['date' => '2026-10-15'])
        ->assertSessionHasNoErrors();

    $cheque->refresh();

    expect($cheque->status)->toBe('cleared')
        ->and($cheque->deposited_on->toDateString())->toBe('2026-10-15')
        ->and($cheque->cleared_on->toDateString())->toBe('2026-10-15')
        ->and($cheque->payment)->not->toBeNull()
        ->and($cheque->updates()->count())->toBe(2);
});

test('marks a cheque handed to the landlord as paid, and refuses one not handed over yet', function () {
    $lease = HeadLease::factory()->create(['property_id' => $this->property->id]);
    $issued = Cheque::factory()->forAgreement($lease)->held()->create(['cheque_date' => '2026-10-01']);
    $notWritten = Cheque::factory()->forAgreement($lease)->create(['sequence' => 2, 'cheque_date' => '2026-10-01']);

    $this->actingAs($this->user)->post(route('cheques.settle', $issued), ['date' => '2026-10-17'])->assertSessionHasNoErrors();
    $this->actingAs($this->user)->post(route('cheques.settle', $notWritten), ['date' => '2026-10-17'])->assertSessionHasErrors(['cheque' => 'This cheque cannot be marked as paid now.']);

    expect($issued->fresh()->status)->toBe('cleared')
        ->and($notWritten->fresh()->status)->toBe('pending');
});

test('another company’s payment and cheque are not found', function () {
    $payment = OtherPayment::factory()->create(['property_id' => $this->property->id]);
    $cheque = Cheque::factory()->forAgreement(HeadLease::factory()->create(['property_id' => $this->property->id]))->held()->create();
    $stranger = User::factory()->create(['company_id' => Property::factory()->create()->company_id]);

    $this->actingAs($stranger)->get(route('other-payments.edit', $payment))->assertNotFound();
    $this->actingAs($stranger)->post(route('other-payments.status', $payment), ['status' => 'cancelled'])->assertNotFound();
    $this->actingAs($stranger)->post(route('cheques.settle', $cheque), ['date' => '2026-10-17'])->assertNotFound();
});
