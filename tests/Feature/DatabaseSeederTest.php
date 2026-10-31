<?php

use App\Models\Apartment;
use App\Models\Company;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use App\Models\RoomAttachment;
use App\Models\Shop;
use App\Models\User;
use App\Models\UserRole;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\PropertySeeder;
use Database\Seeders\StaffSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Database\Eloquent\Model;

/**
 * Names of the columns that hold no value, ignoring soft-delete markers.
 *
 * @return array<int, string>
 */
function blankColumns(Model $model): array
{
    return collect($model->getAttributes())
        ->filter(fn ($value) => $value === null)
        ->keys()
        ->diff(['deleted_at'])
        ->values()
        ->all();
}

it('seeds one company with two super admins and two properties of five rooms each', function () {
    $this->seed(DatabaseSeeder::class);

    $company = Company::sole();
    $superAdminRole = UserRole::query()->where('slug', UserRole::SUPER_ADMIN)->sole();
    $admins = $company->users()->whereDoesntHave('staffMember')->get();

    expect($admins)->toHaveCount(2);

    $admins->each(function (User $user) use ($superAdminRole) {
        expect($user->user_role_id)->toBe($superAdminRole->id)
            ->and($user->is_admin)->toBeTrue();
    });

    // The demo staff who can sign in are not admins; their staff records say what they can do.
    expect($company->users()->whereHas('staffMember')->where('is_admin', false)->count())->toBe(count(StaffSeeder::SIGN_INS));

    expect($company->properties)->toHaveCount(2);

    $company->properties->each(function (Property $property) use ($company) {
        expect($property->rooms)->toHaveCount(5)
            ->and($property->total_rooms)->toBe(5)
            ->and($property->total_capacity)->toBe($property->rooms->sum('capacity'))
            ->and($property->rooms->pluck('company_id')->unique()->all())->toBe([$company->id])
            ->and($property->documents)->toHaveCount(3);

        $property->rooms->each(fn (Room $room) => expect($room->attachments)->toHaveCount(2)
            ->and($room->attachments->where('is_primary', true))->toHaveCount(1));
    });
});

it('seeds apartments and shops under the demo properties', function () {
    $this->seed(DatabaseSeeder::class);

    $company = Company::sole();
    $alQuoz = $company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
    $jebelAli = $company->properties()->where('code', PropertySeeder::JEBEL_ALI)->sole();

    expect($alQuoz->apartments)->toHaveCount(2)
        ->and($jebelAli->apartments)->toHaveCount(5)
        ->and($alQuoz->shops)->toHaveCount(4)
        ->and($jebelAli->shops)->toHaveCount(2)
        ->and(Apartment::pluck('company_id')->unique()->all())->toBe([$company->id])
        ->and(Shop::pluck('company_id')->unique()->all())->toBe([$company->id]);
});

it('lets a seeded super admin sign in with the demo password', function () {
    $this->seed(DatabaseSeeder::class);

    $this->post('/login', [
        'email' => 'omar.rahman@horizonfm.test',
        'password' => UserSeeder::DEMO_PASSWORD,
    ]);

    $this->assertAuthenticated();
});

it('can be run again without duplicating records', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    expect(UserRole::count())->toBe(count(UserRole::BUILT_IN))
        ->and(Company::count())->toBe(1)
        ->and(User::count())->toBe(2 + count(StaffSeeder::SIGN_INS))
        ->and(Property::count())->toBe(2)
        ->and(Room::count())->toBe(10)
        ->and(Apartment::count())->toBe(7)
        ->and(Shop::count())->toBe(6)
        ->and(PropertyDocument::count())->toBe(6)
        ->and(RoomAttachment::count())->toBe(20);
});

it('fills every column except those that do not apply', function () {
    $this->seed(DatabaseSeeder::class);

    expect(blankColumns(Company::sole()))->toBe([])
        ->and(blankColumns(Room::first()))->toBe([])
        ->and(blankColumns(RoomAttachment::first()))->toBe([]);

    UserRole::all()->each(fn (UserRole $role) => expect(blankColumns($role))->toBe([]));
    Apartment::all()->each(fn (Apartment $apartment) => expect(blankColumns($apartment))->toBe([]));
    Shop::all()->each(fn (Shop $shop) => expect(blankColumns($shop))->toBe([]));

    // A user's remember token is only set when they sign in; a staff member's sign-in has no user role.
    User::all()->each(fn (User $user) => expect(blankColumns($user))->toBe($user->staffMember ? ['remember_token', 'user_role_id'] : ['remember_token']));

    // Landlord and lease details do not apply to a property the company owns.
    expect(blankColumns(Property::where('code', PropertySeeder::AL_QUOZ)->sole()))
        ->toEqualCanonicalizing(['landlord_id', 'lease_start_date', 'lease_end_date'])
        ->and(blankColumns(Property::where('code', PropertySeeder::JEBEL_ALI)->sole()))->toBe([]);

    // A title deed does not expire, and an owned property's documents are not filed under a lease.
    PropertyDocument::with('property')->get()->each(fn (PropertyDocument $document) => expect(blankColumns($document))
        ->toEqualCanonicalizing([
            ...($document->document_type === 'title_deed' ? ['expires_on'] : []),
            ...($document->property->ownership_type === 'owned' ? ['head_lease_id'] : []),
        ]));
});

it('seeds data that satisfies the database check constraints SQLite does not enforce', function () {
    $this->seed(DatabaseSeeder::class);

    expect(Room::where('capacity', '<', 1)->orWhere('monthly_rent', '<', 0)->exists())->toBeFalse()
        ->and(Property::whereColumn('lease_end_date', '<', 'lease_start_date')->exists())->toBeFalse()
        ->and(PropertyDocument::whereColumn('expires_on', '<', 'issued_on')->exists())->toBeFalse()
        ->and(Property::pluck('makani_number')->every(fn (string $number) => preg_match('/^[0-9]{10}$/', $number) === 1))->toBeTrue()
        ->and(Room::pluck('amenities')->every(fn ($amenities) => is_array($amenities) && array_is_list($amenities)))->toBeTrue()
        ->and(Apartment::pluck('amenities')->merge(Shop::pluck('amenities'))->every(fn ($amenities) => is_array($amenities) && array_is_list($amenities)))->toBeTrue()
        ->and(Apartment::whereIn('status', Apartment::STATUSES)->count())->toBe(Apartment::count())
        ->and(Apartment::whereIn('furnishing_status', Apartment::FURNISHING_STATUSES)->count())->toBe(Apartment::count())
        ->and(Shop::whereIn('status', Shop::STATUSES)->count())->toBe(Shop::count())
        ->and(Apartment::where('bedrooms', '<', 0)->orWhere('bathrooms', '<', 0)->orWhere('max_occupants', '<=', 0)->exists())->toBeFalse()
        ->and(Apartment::where('area_sqm', '<=', 0)->orWhere('monthly_rent', '<', 0)->orWhere('security_deposit', '<', 0)->exists())->toBeFalse()
        ->and(Shop::where('area_sqm', '<=', 0)->orWhere('monthly_rent', '<', 0)->orWhere('security_deposit', '<', 0)->exists())->toBeFalse();
});

it('seeds one document that expires within the next month', function () {
    $this->seed(DatabaseSeeder::class);

    $expiringSoon = PropertyDocument::whereBetween('expires_on', [today(), today()->addDays(31)])->get();

    expect($expiringSoon)->toHaveCount(1)
        ->and($expiringSoon->first()->document_type)->toBe('civil_defence_certificate');
});

it('builds valid records from the factories', function () {
    $room = Room::factory()->create();
    $attachment = RoomAttachment::factory()->primary()->for($room)->create();
    $document = PropertyDocument::factory()->for($room->property)->create();
    $apartment = Apartment::factory()->for($room->property)->create();
    $shop = Shop::factory()->for($room->property)->create();

    expect($apartment->company_id)->toBe($room->property->company_id)
        ->and($shop->company_id)->toBe($room->property->company_id)
        ->and($room->property->apartments->first()->is($apartment))->toBeTrue()
        ->and($room->property->shops->first()->is($shop))->toBeTrue()
        ->and($room->company_id)->toBe($room->property->company_id)
        ->and($attachment->room->is($room))->toBeTrue()
        ->and($attachment->is_primary)->toBeTrue()
        ->and($document->property->is($room->property))->toBeTrue();
});
