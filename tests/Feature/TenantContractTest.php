<?php

use App\Models\Cheque;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractDocument;
use App\Models\ContractLine;
use App\Models\Property;
use App\Models\Room;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));

    $this->property = Property::factory()->create();
    $this->user = User::factory()->create(['company_id' => $this->property->company_id]);
    $this->contract = fn (string $clientName, array $attributes = []) => Contract::factory()->active()->create([
        'client_id' => Client::factory()->create(['company_id' => $this->property->company_id, 'name' => $clientName])->id,
        ...$attributes,
    ]);
    $this->room = fn (string $number) => Room::factory()->create(['property_id' => $this->property->id, 'room_number' => $number, 'capacity' => 4]);
    $this->line = fn (Contract $contract, array $attributes) => ContractLine::factory()->create([
        'contract_id' => $contract->id,
        'property_id' => $this->property->id,
        ...$attributes,
    ]);
});

test('shows each client with their contracts here, the rooms they hold, documents and every cheque by status', function () {
    $contract = ($this->contract)('Al Hajar Contracting', ['security_deposit' => 5000]);
    ($this->line)($contract, ['unit_type' => 'room', 'room_id' => ($this->room)('101')->id, 'monthly_rate' => 3000]);
    ($this->line)($contract, ['unit_type' => 'room', 'room_id' => ($this->room)('102')->id, 'monthly_rate' => 1000]);
    // The same contract also rents a room in another property, which this page leaves out.
    ContractLine::factory()->create(['contract_id' => $contract->id, 'monthly_rate' => 1200]);
    ContractDocument::factory()->create(['contract_id' => $contract->id, 'title' => 'Signed tenancy']);
    Cheque::factory()->forAgreement($contract)->create(['sequence' => 1, 'cheque_date' => '2026-08-01', 'amount' => 4000, 'status' => 'cleared', 'cleared_on' => '2026-08-02']);
    // In hand and past its date, so overdue for deposit.
    Cheque::factory()->forAgreement($contract)->held()->create(['sequence' => 2, 'cheque_date' => '2026-09-01', 'amount' => 4000]);
    Cheque::factory()->forAgreement($contract)->create(['sequence' => 3, 'cheque_date' => '2026-11-01', 'amount' => 4000]);

    $ended = ($this->contract)('Titan Construction', ['status' => 'ended', 'start_date' => '2025-01-01', 'end_date' => '2025-12-31']);
    ($this->line)($ended, ['unit_type' => 'room', 'room_id' => ($this->room)('103')->id, 'monthly_rate' => 2800]);

    // A contract renting only in another property is not listed.
    ContractLine::factory()->create(['contract_id' => ($this->contract)('Elsewhere Trading')->id]);

    $this->actingAs($this->user)
        ->get(route('properties.tenant-contracts', $this->property))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Properties/TenantContracts')
            ->where('property.code', $this->property->code)
            ->has('clients', 2)
            ->where('clients.0.name', 'Al Hajar Contracting')
            ->where('clients.0.liveContracts', 1)
            ->where('clients.0.units', ['rooms' => 2, 'capacity' => 8, 'shops' => 0, 'apartments' => 0])
            ->where('clients.0.monthly', 4000)
            ->where('clients.0.contracts.0.number', $contract->contract_number)
            ->where('clients.0.contracts.0.otherProperties', 1)
            ->has('clients.0.contracts.0.lines', 2)
            ->where('clients.0.contracts.0.lines.0.roomNumber', '101')
            ->where('clients.0.contracts.0.lines.0.capacity', 4)
            ->where('clients.0.contracts.0.documents.0.title', 'Signed tenancy')
            ->has('clients.0.contracts.0.cheques', 3)
            ->where('clients.0.contracts.0.chequeSummary.stages.cleared', ['count' => 1, 'amount' => 4000])
            ->where('clients.0.contracts.0.chequeSummary.stages.received', ['count' => 1, 'amount' => 4000])
            ->where('clients.0.contracts.0.chequeSummary.stages.pending', ['count' => 1, 'amount' => 4000])
            ->where('clients.0.contracts.0.chequeSummary.overdue', ['count' => 1, 'amount' => 4000])
            ->where('clients.1.name', 'Titan Construction')
            ->where('clients.1.liveContracts', 0)
            ->where('clients.1.units.rooms', 0)
            ->where('clients.1.contracts.0.status', 'ended')
            ->where('summary.clients', 1)
            ->where('summary.contracts', ['draft' => 0, 'active' => 1, 'ended' => 1, 'terminated' => 0])
            ->where('summary.units', ['rooms' => 2, 'capacity' => 8, 'shops' => 0, 'apartments' => 0])
            ->where('summary.monthly', 4000)
            ->where('summary.deposits', 5000)
            ->where('summary.cheques.stages.cleared', ['count' => 1, 'amount' => 4000])
            ->where('summary.cheques.overdue.count', 1)
        );
});

test('hides another company\'s property', function () {
    $this->actingAs(User::factory()->create(['company_id' => Property::factory()->create()->company_id]))
        ->get(route('properties.tenant-contracts', $this->property))
        ->assertNotFound();
});
