<?php

use App\Models\Apartment;
use App\Models\Bed;
use App\Models\Cheque;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\HeadLease;
use App\Models\Invoice;
use App\Models\Landlord;
use App\Models\Occupancy;
use App\Models\Occupant;
use App\Models\Payment;
use App\Models\Property;
use App\Models\Room;
use App\Models\Shop;
use Database\Seeders\ClientSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PropertySeeder;

beforeEach(function () {
    // The demo invoices and payments are generated up to "today".
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
});

it('seeds landlords, clients, contracts, stays, invoices and payments for the demo company', function () {
    $this->seed(DatabaseSeeder::class);

    expect(Bed::count())->toBe(37)
        ->and(Landlord::count())->toBe(2)
        ->and(HeadLease::count())->toBe(2)
        ->and(Cheque::where('direction', 'issued')->count())->toBe(18)
        ->and(Client::count())->toBe(12)
        ->and(Contract::count())->toBe(11)
        ->and(ContractLine::count())->toBe(16)
        ->and(Occupant::count())->toBe(30)
        ->and(Occupancy::whereNull('check_out_date')->count())->toBe(28)
        ->and(Invoice::count())->toBe(50)
        ->and(Payment::count())->toBe(47);
});

it('derives every room\'s occupied count from the people staying in it', function () {
    $this->seed(DatabaseSeeder::class);

    Room::with('beds')->get()->each(function (Room $room) {
        $staying = Occupancy::whereNull('check_out_date')->whereIn('bed_id', $room->beds->pluck('id'))->count();

        expect($room->occupied_count)->toBe($staying)
            ->and($room->beds->where('is_active', true)->count())->toBe($room->capacity);
    });
});

it('keeps apartment and shop statuses in step with the contracts', function () {
    $this->seed(DatabaseSeeder::class);

    expect(Apartment::where('status', 'occupied')->pluck('apartment_number')->sort()->values()->all())->toBe(['B-301', 'B-401', 'C-101'])
        ->and(Apartment::where('status', 'reserved')->pluck('apartment_number')->all())->toBe(['B-303'])
        ->and(Shop::where('status', 'occupied')->count())->toBe(3)
        ->and(Shop::where('status', 'reserved')->count())->toBe(1);
});

it('leaves this month\'s invoices in the states the demo describes', function () {
    $this->seed(DatabaseSeeder::class);

    expect(Invoice::where('status', 'paid')->count())->toBe(45)
        ->and(Invoice::where('status', 'issued')->count())->toBe(4)
        ->and(Invoice::where('status', 'partially_paid')->count())->toBe(1)
        ->and(Payment::where('status', 'pending')->count())->toBe(1)
        ->and(Payment::where('status', 'bounced')->count())->toBe(1);

    $balance = fn (string $name) => Client::where('name', $name)->sole()->outstandingBalance();

    expect($balance(ClientSeeder::GULF_BUILDERS))->toBe(14700.0)
        ->and($balance(ClientSeeder::AL_NOOR))->toBe(2100.0)
        ->and($balance(ClientSeeder::DANIEL))->toBe(1700.0)
        ->and($balance(ClientSeeder::FRESHFOLD))->toBe(15120.0)
        ->and($balance(ClientSeeder::BREW_CORNER))->toBe(5880.0)
        ->and($balance(ClientSeeder::RAHUL))->toBe(0.0);
});

it('bills the first invoice with the deposit and VAT only on shop rent', function () {
    $this->seed(DatabaseSeeder::class);

    $miniMart = Client::where('name', ClientSeeder::MINI_MART)->sole();
    [$first, $second] = $miniMart->invoices()->orderBy('period_start')->limit(2)->get();

    expect((float) $first->subtotal)->toBe(26000.0)
        ->and((float) $first->vat_amount)->toBe(975.0)
        ->and((float) $second->subtotal)->toBe(19500.0)
        ->and($first->items()->where('item_type', 'deposit')->count())->toBe(1)
        ->and($second->items()->where('item_type', 'deposit')->count())->toBe(0);
});

it('clears the landlord cheques already due and copies the running lease onto the property', function () {
    $this->seed(DatabaseSeeder::class);

    $current = HeadLease::where('lease_number', 'HL-2026-0001')->sole();
    $property = Property::where('code', PropertySeeder::JEBEL_ALI)->sole();

    $rent = fn () => $current->cheques()->where('purpose', 'rent');

    expect($rent()->where('status', 'cleared')->count())->toBe(4)
        ->and($rent()->where('status', 'pending')->count())->toBe(8)
        ->and((float) $rent()->value('amount'))->toBe(195000.0)
        ->and($current->cheques()->where('purpose', 'security_deposit')->value('status'))->toBe('cleared')
        ->and($current->renewedFrom->lease_number)->toBe('HL-2025-0001')
        ->and($property->ownership_type)->toBe('leased')
        ->and($property->landlord->name)->toBe('Al Marsa Properties L.L.C.');
});

it('can be run again without duplicating leasing records', function () {
    $this->seed(DatabaseSeeder::class);
    $cheques = Cheque::count();
    $this->seed(DatabaseSeeder::class);

    expect(Landlord::count())->toBe(2)
        ->and(Cheque::where('direction', 'issued')->count())->toBe(18)
        ->and(Cheque::count())->toBe($cheques)
        ->and(Contract::count())->toBe(11)
        ->and(Occupancy::count())->toBe(30)
        ->and(Invoice::count())->toBe(50)
        ->and(Payment::count())->toBe(47);
});
