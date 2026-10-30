<?php

use App\Models\ExtraIncome;
use App\Models\Property;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));

    $this->property = Property::factory()->create();
    $this->user = User::factory()->create(['company_id' => $this->property->company_id]);
    $this->income = fn (array $attributes = []) => [
        'property_id' => $this->property->id,
        'title' => 'Internet commission for October',
        'received_from' => 'Emirates Fibre Services',
        'amount' => 10000,
        'received_on' => '2026-10-15',
        'method' => 'bank_transfer',
        'invoice_number' => 'INV-2026-118',
        ...$attributes,
    ];
    $this->setStatus = fn (ExtraIncome $income, string $status) => $this->actingAs($this->user)
        ->from(route('properties.payments', $this->property))
        ->post(route('extra-incomes.status', $income), ['status' => $status]);
});

test('adds extra income from a property\'s payments, received and counted with the contract cheques and in the cash ledger', function () {
    Storage::fake('local');

    $this->actingAs($this->user)
        ->get(route('extra-incomes.create', ['property' => $this->property->id, 'from' => 'payments']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('ExtraIncome/Form')
            ->where('defaults', ['property_id' => $this->property->id, 'from_payments' => true])
        );

    $this->actingAs($this->user)
        ->post(route('extra-incomes.store'), ($this->income)([
            'from_payments' => true,
            'invoice' => UploadedFile::fake()->create('invoice.pdf', 120, 'application/pdf'),
        ]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('properties.payments', $this->property));

    $income = ExtraIncome::query()->sole();

    expect($income->income_number)->toBe('EI-2026-0001')
        ->and($income->status)->toBe('received')
        ->and($income->created_by)->toBe($this->user->id)
        ->and($income->invoice_name)->toBe('invoice.pdf');
    Storage::disk('local')->assertExists($income->invoice_path);

    $this->actingAs($this->user)
        ->get(route('properties.payments', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->has('incoming.extraIncome', 1)
            ->where('incoming.extraIncome.0.number', 'EI-2026-0001')
            ->where('incoming.extraIncome.0.receivedFrom', 'Emirates Fibre Services')
            ->where('incoming.extraIncome.0.status', 'received')
            ->where('summary.extraIncome', ['count' => 1, 'amount' => 10000])
            ->where('summary.income.extra', 10000)
            ->where('summary.income.total', 10000)
            ->where('summary.profit', 10000)
        );

    $this->actingAs($this->user)
        ->get(route('payments.overview'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('totals.extra_income', ['count' => 1, 'amount' => 10000])
            ->where('transactions.data.0.direction', 'in')
            ->where('transactions.data.0.parentId', $this->property->id)
        );
});

test('extra income added from the payments menu goes back to its list, which totals it by period', function () {
    $this->actingAs($this->user)
        ->post(route('extra-incomes.store'), ($this->income)(['method' => 'cheque']))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('extra-incomes.index'));
    ExtraIncome::factory()->create(['property_id' => $this->property->id, 'amount' => 2500, 'received_on' => '2026-09-20']);

    $this->actingAs($this->user)
        ->get(route('extra-incomes.index', ['period' => 'this_month']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('ExtraIncome/Index')
            ->where('incomes.total', 1)
            ->where('incomes.data.0.property.id', $this->property->id)
            ->where('summary.received', ['amount' => 10000, 'count' => 1])
            ->where('summary.byMethod.cheque', 10000)
        );

    $this->actingAs($this->user)
        ->get(route('extra-incomes.index', ['search' => 'fibre']))
        ->assertInertia(fn (Assert $page) => $page->where('incomes.total', 1));
});

test('extra income needs who paid, an amount, how it came in and a day not after today', function () {
    $this->actingAs($this->user)
        ->post(route('extra-incomes.store'), ($this->income)(['received_from' => '', 'amount' => 0, 'method' => null, 'received_on' => '2026-10-20']))
        ->assertSessionHasErrors(['received_from', 'amount', 'method', 'received_on']);

    $elsewhere = Property::factory()->create();

    $this->actingAs($this->user)
        ->post(route('extra-incomes.store'), ($this->income)(['property_id' => $elsewhere->id]))
        ->assertSessionHasErrors('property_id');

    expect(ExtraIncome::query()->count())->toBe(0);
});

test('cancelled extra income no longer counts until it is counted as received again', function () {
    $income = ExtraIncome::factory()->create(['property_id' => $this->property->id, 'amount' => 5000, 'received_on' => '2026-10-10']);

    ($this->setStatus)($income, 'cancelled')->assertSessionHasNoErrors();
    ($this->setStatus)($income, 'cancelled')->assertSessionHasErrors('status');

    $this->actingAs($this->user)
        ->get(route('properties.payments', $this->property))
        ->assertInertia(fn (Assert $page) => $page
            ->where('incoming.extraIncome.0.status', 'cancelled')
            ->where('summary.extraIncome', ['count' => 0, 'amount' => 0])
            ->where('summary.income.total', 0)
        );
    $this->actingAs($this->user)
        ->get(route('payments.overview'))
        ->assertInertia(fn (Assert $page) => $page->where('totals.extra_income', ['count' => 0, 'amount' => 0]));

    ($this->setStatus)($income, 'received')->assertSessionHasNoErrors();

    expect($income->fresh()->status)->toBe('received');
});

test('corrects extra income on its form, going back to the property\'s payments it was opened from', function () {
    $income = ExtraIncome::factory()->create(['property_id' => $this->property->id]);

    $this->actingAs($this->user)
        ->get(route('extra-incomes.edit', ['extraIncome' => $income, 'from' => 'payments']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('income.number', $income->income_number)
            ->where('defaults.from_payments', true)
        );

    $this->actingAs($this->user)
        ->put(route('extra-incomes.update', $income), ($this->income)(['amount' => 12500, 'from_payments' => true]))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('properties.payments', $this->property));

    expect((float) $income->fresh()->amount)->toBe(12500.0)
        ->and($income->fresh()->status)->toBe('received');
});

test('hides another company\'s extra income', function () {
    $income = ExtraIncome::factory()->create();

    $this->actingAs($this->user)->get(route('extra-incomes.edit', $income))->assertNotFound();
    $this->actingAs($this->user)->put(route('extra-incomes.update', $income), ($this->income)())->assertNotFound();
    $this->actingAs($this->user)->post(route('extra-incomes.status', $income), ['status' => 'cancelled'])->assertNotFound();
    $this->actingAs($this->user)->get(route('extra-incomes.invoice', $income))->assertNotFound();
});
