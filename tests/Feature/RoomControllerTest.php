<?php

use App\Models\Property;
use App\Models\Room;
use App\Models\RoomType;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array<string, mixed>
 */
function validRoomInput(Property $property, array $overrides = []): array
{
    return [
        'property_id' => $property->id,
        'room_number' => '301',
        'block' => 'B',
        'floor_number' => 3,
        'room_type_id' => RoomType::where('slug', 'shared_room')->value('id'),
        'gender_policy' => 'male',
        'capacity' => 4,
        'occupied_count' => 1,
        'area_sqm' => 24,
        'rent_per_bed' => 650,
        'amenities' => ['air_conditioning', 'wifi'],
        'status' => 'active',
        ...$overrides,
    ];
}

test('guests are redirected to the login page', function () {
    $this->get(route('rooms.index'))->assertRedirect(route('login'));
});

test('users without a company see an empty list and cannot add rooms', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('rooms.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Rooms/Index')->where('company', null));

    $this->actingAs($user)->get(route('rooms.create'))->assertForbidden();
});

describe('for the seeded demo company', function () {
    beforeEach(function () {
        $this->seed(PortfolioSeeder::class);

        $this->superAdmin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
        $this->alQuoz = Property::where('code', 'HFM-AQZ-01')->sole();
    });

    test('lists rooms with their property, occupancy and portfolio summary', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('rooms.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Rooms/Index')
                ->where('rooms.total', 10)
                ->where('rooms.data.0.property.code', 'HFM-AQZ-01')
                ->where('rooms.data.0.number', '101')
                ->where('rooms.data.0.photoUrl', '/images/demo/room-dormitory.svg')
                ->where('summary.rooms', 10)
                ->where('summary.maintenance', 1)
                ->where('summary.beds.occupancyRate', 87.1)
                ->where('summary.rentRoll', 17450)
            );
    });

    test('narrows the list by each filter', function (array $query, int $total) {
        $this->actingAs($this->superAdmin)
            ->get(route('rooms.index', $query))
            ->assertInertia(fn (Assert $page) => $page->where('rooms.total', $total));
    })->with([
        'property' => [['properties' => ['HFM-JBA-01']], 5],
        'type' => [['types' => ['dormitory']], 2],
        'status' => [['status' => ['under_maintenance']], 1],
        'gender' => [['gender' => ['female']], 2],
        'available beds' => [['availability' => ['available']], 4],
        'full' => [['availability' => ['full']], 5],
        'search by room number' => [['search' => '20'], 4],
        'search by property name' => [['search' => 'jebel'], 5],
    ]);

    test('counts each filter option against the other filters', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('rooms.index', ['properties' => ['HFM-JBA-01']]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('facets.properties.0.count', 5)
                ->where('facets.properties.1.count', 5)
                ->where('facets.availability', [
                    ['value' => 'available', 'count' => 2],
                    ['value' => 'full', 'count' => 3],
                ])
            );
    });

    test('sorts by occupancy', function () {
        $this->actingAs($this->superAdmin)
            ->get(route('rooms.index', ['sort' => 'occupancy', 'direction' => 'asc']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('rooms.data.0.occupied', 0)
            );
    });

    test('ignores other companies\' rooms', function () {
        Room::factory()->count(3)->create();

        $this->actingAs($this->superAdmin)
            ->get(route('rooms.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('rooms.total', 10)
                ->where('summary.rooms', 10)
            );
    });

    test('adds a room with photos and refreshes the property totals', function () {
        Storage::fake('public');

        $this->actingAs($this->superAdmin)
            ->post(route('rooms.store'), validRoomInput($this->alQuoz, [
                'photos' => [UploadedFile::fake()->image('one.jpg'), UploadedFile::fake()->image('two.jpg')],
            ]))
            ->assertRedirect(route('rooms.index'))
            ->assertSessionHas('success', 'Room 301 was added to Al Quoz Worker Village.');

        $room = $this->alQuoz->rooms()->where('room_number', '301')->sole();

        expect($room->company_id)->toBe($this->alQuoz->company_id)
            ->and($room->amenities)->toBe(['air_conditioning', 'wifi']);
        expect($room->attachments()->where('is_primary', true)->count())->toBe(1);
        expect($room->attachments()->count())->toBe(2);
        expect($this->alQuoz->refresh()->total_rooms)->toBe(6)
            ->and($this->alQuoz->total_capacity)->toBe(34);
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $room->attachments()->first()->file_url));
    });

    test('rejects invalid rooms', function (array $overrides, string $field) {
        $this->actingAs($this->superAdmin)
            ->post(route('rooms.store'), validRoomInput($this->alQuoz, $overrides))
            ->assertSessionHasErrors($field);

        expect($this->alQuoz->rooms()->count())->toBe(5);
    })->with([
        'number taken in the property' => [['room_number' => '101'], 'room_number'],
        'no beds' => [['capacity' => 0], 'capacity'],
        'unknown amenity' => [['amenities' => ['pool']], 'amenities.0'],
    ]);

    test('refuses a property from another company', function () {
        $otherProperty = Property::factory()->create();

        $this->actingAs($this->superAdmin)
            ->post(route('rooms.store'), validRoomInput($otherProperty))
            ->assertSessionHasErrors('property_id');

        expect($otherProperty->rooms()->count())->toBe(0);
    });

    test('updates a room, removing photos that were not kept', function () {
        $room = $this->alQuoz->rooms()->where('room_number', '101')->sole();
        [$cover, $interior] = $room->attachments()->orderBy('sort_order')->get();

        $this->actingAs($this->superAdmin)
            ->get(route('rooms.edit', $room))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Rooms/Form')
                ->where('room.room_number', '101')
                ->has('room.photos', 2)
            );

        $this->actingAs($this->superAdmin)
            ->put(route('rooms.update', $room), validRoomInput($this->alQuoz, [
                'room_number' => '101',
                'capacity' => 10,
                'occupied_count' => 7,
                'keep_photos' => [$interior->id],
            ]))
            ->assertRedirect(route('rooms.index'));

        expect($room->refresh()->capacity)->toBe(10);
        $this->assertSoftDeleted($cover);
        expect($interior->refresh()->is_primary)->toBeTrue();
        expect($this->alQuoz->refresh()->total_capacity)->toBe(32);
    });

    test('creates one bed per unit of capacity and ignores a typed occupied count', function () {
        $this->actingAs($this->superAdmin)
            ->post(route('rooms.store'), validRoomInput($this->alQuoz, ['capacity' => 3, 'occupied_count' => 2]))
            ->assertSessionHasNoErrors();

        $room = $this->alQuoz->rooms()->where('room_number', '301')->sole();

        expect($room->occupied_count)->toBe(0)
            ->and($room->beds()->where('is_active', true)->pluck('label')->all())->toBe(['1', '2', '3']);

        $this->actingAs($this->superAdmin)
            ->put(route('rooms.update', $room), validRoomInput($this->alQuoz, ['capacity' => 2]))
            ->assertSessionHasNoErrors();

        expect($room->beds()->where('is_active', true)->count())->toBe(2)
            ->and($room->beds()->count())->toBe(3);
    });

    test('refuses fewer beds than the people staying in the room', function () {
        $room = $this->alQuoz->rooms()->where('room_number', '101')->sole();

        $this->actingAs($this->superAdmin)
            ->put(route('rooms.update', $room), validRoomInput($this->alQuoz, ['room_number' => '101', 'capacity' => $room->occupied_count - 1]))
            ->assertSessionHasErrors('capacity');

        expect($room->refresh()->capacity)->toBe(8);
    });

    test('hides other companies\' rooms', function () {
        $otherRoom = Room::factory()->create();

        $this->actingAs($this->superAdmin)->get(route('rooms.edit', $otherRoom))->assertNotFound();
        $this->actingAs($this->superAdmin)
            ->put(route('rooms.update', $otherRoom), validRoomInput($this->alQuoz))
            ->assertNotFound();
    });
});
