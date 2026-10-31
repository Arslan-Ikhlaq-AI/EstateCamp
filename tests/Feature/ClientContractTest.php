<?php

use App\Models\Apartment;
use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractDocument;
use App\Models\ContractLine;
use App\Models\Property;
use App\Models\Shop;
use App\Models\User;
use Database\Seeders\ClientSeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 17)->setTime(10, 0));
    $this->seed(DatabaseSeeder::class);

    $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->alQuoz = Property::where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->jebelAli = Property::where('code', PropertySeeder::JEBEL_ALI)->sole();
    $this->alNoor = Client::where('name', ClientSeeder::AL_NOOR)->sole();
    $this->gulfBuilders = Client::where('name', ClientSeeder::GULF_BUILDERS)->sole();
});

/**
 * A contract renting one apartment for the whole term, at its list price.
 *
 * @return array<string, mixed>
 */
function apartmentContractInput(Client $client, Apartment $apartment, array $overrides = []): array
{
    return [
        'client_id' => $client->id,
        'start_date' => '2026-11-01',
        'end_date' => '2027-10-31',
        'billing_cycle' => 'monthly',
        'payment_terms_days' => 7,
        'security_deposit' => null,
        'monthly_rent' => 5200,
        ...$overrides,
        'lines' => [['unit_type' => 'apartment', 'property_id' => $apartment->property_id, 'apartment_id' => $apartment->id]],
    ];
}

/**
 * The submitted form for an existing contract, with its units and rent as they are.
 *
 * @return array<string, mixed>
 */
function existingContractInput(Contract $contract): array
{
    $lines = $contract->lines()->orderBy('id')->get();

    return [
        ...$contract->only(['client_id', 'billing_cycle', 'payment_terms_days', 'security_deposit']),
        'start_date' => $contract->start_date->toDateString(),
        'end_date' => $contract->end_date->toDateString(),
        'monthly_rent' => $lines->sum(fn (ContractLine $line) => (float) $line->monthly_rate),
        'lines' => $lines->map(fn (ContractLine $line) => [
            'id' => $line->id,
            ...$line->only(['unit_type', 'property_id', 'room_id', 'apartment_id', 'shop_id']),
            'start_date' => $line->start_date->toDateString(),
            'end_date' => $line->end_date->toDateString(),
        ])->all(),
    ];
}

describe('clients', function () {
    test('lists clients with what they owe', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('clients.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Clients/Index')
                ->where('clients.total', 12)
                ->where('summary.companies', 8)
                ->where('summary.staying', 27)
                ->where('summary.receivable', 39800)
                ->where('summary.overdue', 38100)
            );
    });

    test('narrows clients by type', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('clients.index', ['types' => ['individual']]))
            ->assertInertia(fn (Assert $page) => $page->where('clients.total', 4));
    });

    test('shows a client with their contracts, the people staying and their invoices', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('clients.show', $this->gulfBuilders))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Clients/Show')
                ->where('client.balance', 14700)
                ->has('contracts', 1)
                ->has('stays', 15)
                ->has('invoices', 10)
            );
    });

    test('adds a company client and drops any identity document', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('clients.store'), [
                'client_type' => 'company',
                'name' => 'Skyline Scaffolding L.L.C.',
                'id_type' => 'passport',
                'id_number' => 'X1234567',
                'status' => 'active',
            ])
            ->assertSessionHasNoErrors();

        $client = Client::where('name', 'Skyline Scaffolding L.L.C.')->sole();

        expect($client->company_id)->toBe($this->superAdmin->company_id)
            ->and($client->id_number)->toBeNull();
    });

    test('needs an identity document for an individual', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('clients.store'), ['client_type' => 'individual', 'name' => 'Someone', 'status' => 'active'])
            ->assertSessionHasErrors(['id_type', 'id_number']);
    });

    test('refuses an ID number another client already has', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('clients.store'), [
                'client_type' => 'individual',
                'name' => 'Duplicate',
                'id_type' => 'passport',
                'id_number' => 'P4821937',
                'status' => 'active',
            ])
            ->assertSessionHasErrors('id_number');
    });
});

describe('contracts', function () {
    test('lists contracts with their value and the rooms they hold', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('contracts.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Contracts/Index')
                ->where('contracts.total', 11)
                ->where('summary.active', 9)
                ->where('summary.drafts', 2)
                ->where('summary.monthlyValue', 55700)
                ->where('summary.contractedRooms', 8)
                ->where('summary.contractedCapacity', 30)
                ->where('summary.staying', 27)
            );
    });

    test('saves a new contract as active and reserves its apartment until it starts', function () {
        $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-102')->sole();

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.store'), apartmentContractInput($this->alNoor, $apartment))
            ->assertSessionHasNoErrors();

        $contract = Contract::where('contract_number', 'CTR-2026-0012')->sole();

        expect($contract->status)->toBe('active')
            ->and($contract->signed_on->toDateString())->toBe('2026-10-17')
            ->and($contract->client_id)->toBe($this->alNoor->id)
            ->and($contract->lines()->count())->toBe(1)
            ->and($apartment->refresh()->status)->toBe('reserved');
    });

    test('refuses an apartment already let for the same days', function () {
        $taken = $this->jebelAli->apartments()->where('apartment_number', 'B-401')->sole();

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.store'), apartmentContractInput($this->alNoor, $taken))
            ->assertSessionHasErrors('lines.0.apartment_id');
    });

    test('rents whole rooms only, and never a room another contract holds', function (string $type, string $roomNumber, string $field) {
        $room = $this->alQuoz->rooms()->where('room_number', $roomNumber)->sole();

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.store'), [
                ...apartmentContractInput($this->alNoor, $this->alQuoz->apartments()->first()),
                'lines' => [['unit_type' => $type, 'property_id' => $this->alQuoz->id, 'room_id' => $room->id]],
            ])
            ->assertSessionHasErrors($field);
    })->with([
        'beds instead of a room' => ['bed', '202', 'lines.0.unit_type'],
        'a room another contract holds' => ['room', '101', 'lines.0.room_id'],
    ]);

    test('shares one monthly rent between the units in proportion to their list prices', function () {
        $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-102')->sole();
        $room = $this->alQuoz->rooms()->where('room_number', '202')->sole();
        $room->update(['status' => 'active']);

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.store'), [
                ...apartmentContractInput($this->alNoor, $apartment, ['monthly_rent' => 8000]),
                'lines' => [
                    ['unit_type' => 'apartment', 'property_id' => $this->alQuoz->id, 'apartment_id' => $apartment->id],
                    ['unit_type' => 'room', 'property_id' => $this->alQuoz->id, 'room_id' => $room->id],
                ],
            ])
            ->assertSessionHasNoErrors();

        $lines = Contract::where('contract_number', 'CTR-2026-0012')->sole()->lines()->orderBy('id')->get();

        // The apartment lists at 5,200 and the room for six at 3,300.
        expect($lines->map(fn (ContractLine $line) => (float) $line->monthly_rate)->all())->toBe([4894.12, 3105.88]);
    });

    test('refuses a unit from a different property than the line', function () {
        $jebelAliRoom = $this->jebelAli->rooms()->first();

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.store'), [
                ...apartmentContractInput($this->alNoor, $this->alQuoz->apartments()->first()),
                'lines' => [[
                    'unit_type' => 'room',
                    'property_id' => $this->alQuoz->id,
                    'room_id' => $jebelAliRoom->id,
                    'monthly_rate' => 1000,
                    'vat_rate' => 0,
                    'start_date' => '2026-11-01',
                    'end_date' => '2027-10-31',
                ]],
            ])
            ->assertSessionHasErrors('lines.0.room_id');
    });

    test('a new contract that starts today takes its apartment before any cheque is collected', function () {
        $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-102')->sole();

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.store'), apartmentContractInput($this->alNoor, $apartment, ['start_date' => '2026-10-17']))
            ->assertSessionHasNoErrors();

        $contract = Contract::where('contract_number', 'CTR-2026-0012')->sole();

        expect($contract->status)->toBe('active')
            ->and($contract->cheques()->where('status', 'pending')->count())->toBe(13)
            ->and($apartment->refresh()->status)->toBe('occupied');
    });

    test('a new contract takes a whole room without anyone checking in', function () {
        $room = $this->alQuoz->rooms()->where('room_number', '202')->sole();
        $room->update(['status' => 'active']);

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.store'), [
                ...apartmentContractInput($this->alNoor, $this->alQuoz->apartments()->first(), ['start_date' => '2026-10-17', 'monthly_rent' => 3300]),
                'lines' => [['unit_type' => 'room', 'property_id' => $this->alQuoz->id, 'room_id' => $room->id]],
            ])
            ->assertSessionHasNoErrors();

        expect($room->peopleStaying())->toBe(0)
            ->and($room->refresh()->is_occupied)->toBeTrue();
    });

    test('saving a renewal puts it in force', function () {
        $contract = Contract::where('contract_number', 'CTR-2026-0004')->sole();
        $this->actingAs($this->superAdmin)->post(route('contracts.renew', $contract));
        $renewal = $contract->renewal()->sole();

        $this->actingAs($this->superAdmin)
            ->put(route('contracts.update', $renewal), existingContractInput($renewal))
            ->assertSessionHasNoErrors();

        expect($renewal->refresh()->status)->toBe('active');
    });

    test('activating a contract that starts later keeps its shop reserved', function () {
        $draft = Contract::where('contract_number', 'CTR-2026-0011')->sole();

        $this->actingAs($this->superAdmin)->post(route('contracts.activate', $draft))->assertSessionHasNoErrors();

        expect($draft->refresh()->status)->toBe('active')
            ->and(Shop::whereKey($draft->lines()->value('shop_id'))->value('status'))->toBe('reserved');
    });

    test('only a draft can be activated', function () {
        $active = Contract::where('contract_number', 'CTR-2026-0001')->sole();

        $this->actingAs($this->superAdmin)->post(route('contracts.activate', $active))->assertSessionHasErrors('status');
    });

    test('terminating a contract checks everyone out and frees its units', function () {
        $contract = Contract::where('contract_number', 'CTR-2026-0003')->sole();

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.terminate', $contract), ['terminated_on' => '2026-10-17', 'termination_reason' => 'Staff moved to a new site'])
            ->assertSessionHasNoErrors();

        expect($contract->refresh()->status)->toBe('terminated')
            ->and($contract->occupancies()->whereNull('check_out_date')->count())->toBe(0)
            ->and($this->jebelAli->rooms()->where('room_number', '103')->value('is_occupied'))->toBeFalse()
            ->and($this->jebelAli->apartments()->where('apartment_number', 'B-401')->value('status'))->toBe('vacant');
    });

    test('renewing a contract starts a draft for the next term', function () {
        $contract = Contract::where('contract_number', 'CTR-2026-0004')->sole();

        $response = $this->actingAs($this->superAdmin)->post(route('contracts.renew', $contract));

        $renewal = $contract->renewal()->sole();

        $response->assertRedirect(route('contracts.edit', $renewal));

        expect($renewal->status)->toBe('draft')
            ->and($renewal->start_date->toDateString())->toBe('2027-12-01')
            ->and($renewal->end_date->toDateString())->toBe('2029-05-31')
            ->and($renewal->lines()->count())->toBe(1);
    });

    test('updates the contract\'s monthly rent', function () {
        $contract = Contract::where('contract_number', 'CTR-2026-0006')->sole();
        $input = [...existingContractInput($contract), 'monthly_rent' => 3900];

        $this->actingAs($this->superAdmin)->put(route('contracts.update', $contract), $input)->assertSessionHasNoErrors();

        expect((float) $contract->lines()->value('monthly_rate'))->toBe(3900.0);
    });

    test('cannot remove a line people have stayed under', function () {
        $contract = Contract::where('contract_number', 'CTR-2026-0001')->sole();
        $input = existingContractInput($contract);
        $input['lines'] = array_values(array_filter($input['lines'], fn (array $line) => $line['unit_type'] === 'apartment'));

        $this->actingAs($this->superAdmin)->put(route('contracts.update', $contract), $input)->assertSessionHasErrors('lines');

        expect($contract->lines()->count())->toBe(3);
    });

    test('hides other companies\' contracts', function () {
        $other = Contract::factory()->create();

        $this->actingAs($this->superAdmin)->get(route('contracts.show', $other))->assertNotFound();
        $this->actingAs($this->superAdmin)->get(route('contracts.edit', $other))->assertNotFound();
        $this->actingAs($this->superAdmin)->post(route('contracts.activate', $other))->assertNotFound();
        $this->actingAs($this->superAdmin)->post(route('contracts.terminate', $other), ['terminated_on' => '2026-10-17'])->assertNotFound();
    });

    test('cannot make a contract for another company\'s client', function () {
        $otherClient = Client::factory()->create();
        $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-102')->sole();

        $this->actingAs($this->superAdmin)
            ->post(route('contracts.store'), apartmentContractInput($otherClient, $apartment))
            ->assertSessionHasErrors('client_id');
    });
});

test('adds a contract for a client created on the contract form, with its documents', function () {
    Storage::fake('public');
    $apartment = $this->alQuoz->apartments()->where('apartment_number', 'C-102')->sole();
    $newClient = [
        'client_type' => 'company',
        'name' => 'Falcon Logistics L.L.C.',
        'phone' => '+971 55 120 3344',
        'trade_license_number' => 'TL-889922',
        'tax_registration_number' => '100778899000003',
        'address' => 'Warehouse 14, Al Quoz Industrial 3, Dubai',
        'id_type' => 'emirates_id',
    ];

    $this->actingAs($this->superAdmin)
        ->post(route('contracts.store'), apartmentContractInput($this->alNoor, $apartment, [
            'client_mode' => 'new',
            'new_client' => [...$newClient, 'tax_registration_number' => '1007788'],
        ]))
        ->assertSessionHasErrors('new_client.tax_registration_number');

    $this->actingAs($this->superAdmin)
        ->post(route('contracts.store'), apartmentContractInput($this->alNoor, $apartment, [
            'client_mode' => 'new',
            'new_client' => $newClient,
            'documents' => [['document_type' => 'trade_license', 'file' => UploadedFile::fake()->create('licence.pdf', 100, 'application/pdf')]],
        ]))
        ->assertSessionHasNoErrors();

    $contract = Contract::where('contract_number', 'CTR-2026-0012')->sole();
    $document = $contract->documents()->sole();

    expect($contract->client->name)->toBe('Falcon Logistics L.L.C.')
        ->and($contract->client->only(['phone', 'tax_registration_number', 'address']))->toBe(['phone' => '+971 55 120 3344', 'tax_registration_number' => '100778899000003', 'address' => 'Warehouse 14, Al Quoz Industrial 3, Dubai'])
        ->and($contract->client->id_type)->toBeNull()
        ->and($contract->client->company_id)->toBe($this->superAdmin->company_id)
        ->and($contract->client->status)->toBe('active')
        ->and($document->document_type)->toBe('trade_license');
    Storage::disk('public')->assertExists(str_replace('/storage/', '', $document->file_url));
});

test('requires an ID for a person added as a client on the contract form', function () {
    $this->actingAs($this->superAdmin)
        ->post(route('contracts.store'), apartmentContractInput($this->alNoor, $this->alQuoz->apartments()->first(), [
            'client_mode' => 'new',
            'new_client' => ['client_type' => 'individual', 'name' => 'Omar Haddad'],
        ]))
        ->assertSessionHasErrors(['new_client.id_type', 'new_client.id_number']);

    expect(Client::where('name', 'Omar Haddad')->exists())->toBeFalse();
});

test('shows which clients rent which units of a property', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('properties.show', $this->alQuoz))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Properties/Show')
            ->where('property.code', PropertySeeder::AL_QUOZ)
            ->has('clients', 5)
            ->where('clients.0.name', ClientSeeder::GULF_BUILDERS)
            ->where('clients.0.rooms', 2)
            ->where('clients.0.apartments', 1)
            ->where('clients.0.monthly', 14700)
            ->where('clients.1.name', ClientSeeder::AL_NOOR)
            ->where('clients.1.rooms', 2)
            ->where('clients.2.name', ClientSeeder::MINI_MART)
            ->where('clients.2.shops', 1)
        );
});

test('lists the contracts renting a property with only what they rent there', function () {
    $contract = Contract::where('contract_number', 'CTR-2026-0001')->sole();
    ContractLine::factory()->for($contract)->create([
        'property_id' => $this->jebelAli->id,
        'unit_type' => 'shop',
        'shop_id' => $this->jebelAli->shops()->where('shop_number', 'G-02')->value('id'),
        'monthly_rate' => 6100,
    ]);

    $this->actingAs($this->superAdmin)
        ->get(route('properties.show', $this->alQuoz))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('contracts', 5)
            ->where('contracts.0.number', 'CTR-2026-0008')
            ->where('contracts.3.number', 'CTR-2026-0001')
            ->where('contracts.3.client.name', ClientSeeder::GULF_BUILDERS)
            ->where('contracts.3.units', ['rooms' => 2, 'apartments' => 1, 'shops' => 0])
            ->where('contracts.3.monthlyValue', 14700)
            ->where('contracts.4.number', 'CTR-2026-0011')
            ->where('contracts.4.status', 'draft')
        );

    $this->actingAs($this->superAdmin)
        ->get(route('properties.show', $this->jebelAli))
        ->assertInertia(fn (Assert $page) => $page
            ->has('contracts', 7)
            ->where('contracts.5.number', 'CTR-2026-0001')
            ->where('contracts.5.units', ['rooms' => 0, 'apartments' => 0, 'shops' => 1])
            ->where('contracts.5.monthlyValue', 6100)
        );
});

test('lists only the rooms a client holds when filtered by client', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('rooms.index', ['clients' => [$this->gulfBuilders->id]]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('rooms.total', 2)
            ->where('filters.clients', [(string) $this->gulfBuilders->id])
        );
});

test('shows a client\'s contract documents on the client page', function () {
    $contract = Contract::where('contract_number', 'CTR-2026-0001')->sole();
    ContractDocument::factory()->for($contract)->create(['document_type' => 'signed_contract']);

    $this->actingAs($this->superAdmin)
        ->get(route('clients.show', $this->gulfBuilders))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('documents', 1)
            ->where('documents.0.document_type', 'signed_contract')
            ->where('documents.0.contract.number', 'CTR-2026-0001')
        );
});

test('shows the contract\'s client, lines and documents on its edit page', function () {
    $contract = Contract::where('contract_number', 'CTR-2026-0001')->sole();
    ContractDocument::factory()->for($contract)->create(['document_type' => 'signed_contract']);

    $this->actingAs($this->superAdmin)
        ->get(route('contracts.edit', $contract))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Contracts/Form')
            ->where('contract.client.name', ClientSeeder::GULF_BUILDERS)
            ->has('contract.lines', 3)
            ->has('contract.documents', 1)
            ->where('contract.staying', $contract->occupancies()->whereNull('check_out_date')->count())
            ->has('contract.balance')
        );
});

test('shows what a client rents across their live contracts', function () {
    $this->actingAs($this->superAdmin)
        ->get(route('clients.show', $this->gulfBuilders))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('holdings', 3)
            ->where('holdings.0.property.code', PropertySeeder::AL_QUOZ)
            ->where('holdings.0.capacity', 8)
            ->where('holdings.0.contract.number', 'CTR-2026-0001')
        );
});
