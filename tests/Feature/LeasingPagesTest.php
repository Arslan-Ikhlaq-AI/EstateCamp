<?php

use App\Models\Client;
use App\Models\Contract;
use App\Models\HeadLease;
use App\Models\Invoice;
use App\Models\Landlord;
use App\Models\Occupant;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
});

test('every leasing page opens for a member of the company', function (Closure $url, string $component) {
    $this->seed(DatabaseSeeder::class);
    $superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();

    $this->actingAs($superAdmin)
        ->get($url())
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component));
})->with([
    'landlords' => [fn () => route('landlords.index'), 'Landlords/Index'],
    'landlord' => [fn () => route('landlords.show', Landlord::first()), 'Landlords/Show'],
    'add landlord' => [fn () => route('landlords.create'), 'Landlords/Form'],
    'edit landlord' => [fn () => route('landlords.edit', Landlord::first()), 'Landlords/Form'],
    'head leases' => [fn () => route('head-leases.index'), 'HeadLeases/Index'],
    'head lease' => [fn () => route('head-leases.show', HeadLease::first()), 'HeadLeases/Show'],
    'add head lease' => [fn () => route('head-leases.create'), 'HeadLeases/Form'],
    'edit head lease' => [fn () => route('head-leases.edit', HeadLease::first()), 'HeadLeases/Form'],
    'landlord payments' => [fn () => route('landlord-payments.index'), 'LandlordPayments/Index'],
    'clients' => [fn () => route('clients.index'), 'Clients/Index'],
    'client' => [fn () => route('clients.show', Client::first()), 'Clients/Show'],
    'add client' => [fn () => route('clients.create'), 'Clients/Form'],
    'edit client' => [fn () => route('clients.edit', Client::first()), 'Clients/Form'],
    'contracts' => [fn () => route('contracts.index'), 'Contracts/Index'],
    'contract' => [fn () => route('contracts.show', Contract::first()), 'Contracts/Show'],
    'new contract' => [fn () => route('contracts.create'), 'Contracts/Form'],
    'edit contract' => [fn () => route('contracts.edit', Contract::first()), 'Contracts/Form'],
    'occupants' => [fn () => route('occupants.index'), 'Occupants/Index'],
    'occupant' => [fn () => route('occupants.show', Occupant::first()), 'Occupants/Show'],
    'register occupant' => [fn () => route('occupants.create'), 'Occupants/Form'],
    'edit occupant' => [fn () => route('occupants.edit', Occupant::first()), 'Occupants/Form'],
    'check in' => [fn () => route('occupancies.create'), 'Occupancies/CheckIn'],
    'invoices' => [fn () => route('invoices.index'), 'Invoices/Index'],
    'invoice' => [fn () => route('invoices.show', Invoice::first()), 'Invoices/Show'],
    'payments' => [fn () => route('payments.index'), 'Payments/Index'],
    'payment' => [fn () => route('payments.show', Payment::first()), 'Payments/Show'],
    'record payment' => [fn () => route('payments.create'), 'Payments/Form'],
]);

test('guests are sent to the login page', function (string $routeName) {
    $this->get(route($routeName))->assertRedirect(route('login'));
})->with(['landlords.index', 'head-leases.index', 'landlord-payments.index', 'clients.index', 'contracts.index', 'occupants.index', 'invoices.index', 'payments.index']);

test('users without a company see empty lists and cannot add records', function (string $index, string $create, string $component) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route($index))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component)->where('company', null));

    $this->actingAs($user)->get(route($create))->assertForbidden();
})->with([
    'landlords' => ['landlords.index', 'landlords.create', 'Landlords/Index'],
    'head leases' => ['head-leases.index', 'head-leases.create', 'HeadLeases/Index'],
    'clients' => ['clients.index', 'clients.create', 'Clients/Index'],
    'contracts' => ['contracts.index', 'contracts.create', 'Contracts/Index'],
    'occupants' => ['occupants.index', 'occupancies.create', 'Occupants/Index'],
    'payments' => ['payments.index', 'payments.create', 'Payments/Index'],
]);

test('an ended contract cannot be edited', function () {
    $this->seed(DatabaseSeeder::class);
    $superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $contract = Contract::where('contract_number', 'CTR-2026-0004')->sole();
    $contract->forceFill(['status' => 'ended'])->save();

    $this->actingAs($superAdmin)->get(route('contracts.edit', $contract))->assertRedirect(route('contracts.show', $contract));
});
