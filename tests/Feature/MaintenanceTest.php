<?php

use App\Models\Company;
use App\Models\MaintenanceCategory;
use App\Models\MaintenanceJob;
use App\Models\MaintenanceStatus;
use App\Models\Property;
use App\Models\Room;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 22)->setTime(10, 0));
    $this->seed(PortfolioSeeder::class);
    Storage::fake(MaintenanceJob::INVOICE_DISK);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->property = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->room = $this->property->rooms()->where('room_number', '101')->sole();
    $this->status = fn (string $slug) => MaintenanceStatus::where('slug', $slug)->sole();
});

/**
 * A problem reported in the demo room.
 *
 * @return array<string, mixed>
 */
function maintenanceInput(array $overrides = []): array
{
    return [
        'property_id' => test()->property->id,
        'unit_type' => 'room',
        'room_id' => test()->room->id,
        'location' => 'Bed 3',
        'maintenance_category_id' => MaintenanceCategory::where('slug', 'furniture_beds')->value('id'),
        'maintenance_status_id' => MaintenanceStatus::where('slug', 'submitted')->value('id'),
        'title' => 'Bed frame broken',
        'priority' => 'high',
        'reported_on' => '2026-10-20',
        'reported_by' => 'Room leader',
        ...$overrides,
    ];
}

test('reports a problem in a room and starts its history', function () {
    $this->actingAs($this->admin)
        ->post(route('maintenance.store'), maintenanceInput())
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $job = MaintenanceJob::sole();

    expect($job->job_number)->toBe('MNT-2026-0001')
        ->and($job->company_id)->toBe($this->company->id)
        ->and($job->room_id)->toBe($this->room->id)
        ->and($job->status->slug)->toBe('submitted')
        ->and($job->created_by)->toBe($this->admin->id)
        ->and($job->completed_on)->toBeNull()
        ->and($job->updates)->toHaveCount(1)
        ->and($job->updates->first()->previous_status_id)->toBeNull()
        ->and($job->updates->first()->changed_on->toDateString())->toBe('2026-10-20');
});

test('rejects a room from another property', function () {
    $otherRoom = Room::where('property_id', '!=', $this->property->id)->firstOrFail();

    $this->actingAs($this->admin)
        ->post(route('maintenance.store'), maintenanceInput(['room_id' => $otherRoom->id]))
        ->assertSessionHasErrors('room_id');

    expect(MaintenanceJob::count())->toBe(0);
});

test('a job logged as already finished needs the amount charged and the invoice', function () {
    $finished = maintenanceInput(['maintenance_status_id' => ($this->status)('maintenance_done')->id, 'completed_on' => '2026-10-21']);

    $this->actingAs($this->admin)
        ->post(route('maintenance.store'), $finished)
        ->assertSessionHasErrors(['amount', 'invoice']);

    $this->actingAs($this->admin)
        ->post(route('maintenance.store'), [...$finished, 'amount' => 320, 'payment_method' => 'cash', 'invoice' => UploadedFile::fake()->image('invoice.jpg')])
        ->assertSessionHasNoErrors();

    $job = MaintenanceJob::sole();

    expect((float) $job->amount)->toBe(320.0)
        ->and($job->completed_on->toDateString())->toBe('2026-10-21')
        ->and($job->invoice_name)->toBe('invoice.jpg');
    Storage::disk(MaintenanceJob::INVOICE_DISK)->assertExists($job->invoice_path);
});

test('moving a job through its statuses keeps the history and asks for the invoice when the work is done', function () {
    $job = MaintenanceJob::factory()->inRoom($this->room)->create(['reported_on' => '2026-10-18']);

    $this->actingAs($this->admin)
        ->post(route('maintenance.status', $job), ['maintenance_status_id' => ($this->status)('on_maintenance')->id, 'changed_on' => '2026-10-19', 'note' => 'Technician on the way'])
        ->assertSessionHasNoErrors();

    $this->actingAs($this->admin)
        ->post(route('maintenance.status', $job), ['maintenance_status_id' => ($this->status)('maintenance_done')->id, 'changed_on' => '2026-10-21'])
        ->assertSessionHasErrors(['amount', 'invoice']);

    $this->actingAs($this->admin)
        ->post(route('maintenance.status', $job), [
            'maintenance_status_id' => ($this->status)('maintenance_done')->id,
            'changed_on' => '2026-10-21',
            'amount' => 650,
            'payment_method' => 'cheque',
            'invoice_number' => 'GSW-2291',
            'invoice' => UploadedFile::fake()->create('invoice.pdf', 120, 'application/pdf'),
        ])
        ->assertSessionHasNoErrors();

    $job->refresh();

    expect($job->status->slug)->toBe('maintenance_done')
        ->and($job->started_on->toDateString())->toBe('2026-10-19')
        ->and($job->completed_on->toDateString())->toBe('2026-10-21')
        ->and((float) $job->amount)->toBe(650.0)
        ->and($job->payment_method)->toBe('cheque')
        ->and($job->isPaid())->toBeFalse()
        ->and($job->updates()->pluck('note')->all())->toBe(['Technician on the way', null]);
    Storage::disk(MaintenanceJob::INVOICE_DISK)->assertExists($job->invoice_path);

    // Paying it keeps the day the work finished; the invoice on file is enough.
    $this->actingAs($this->admin)
        ->post(route('maintenance.status', $job), ['maintenance_status_id' => ($this->status)('payment_done')->id, 'changed_on' => '2026-10-22', 'amount' => 650, 'paid_on' => '2026-10-22'])
        ->assertSessionHasNoErrors();

    expect($job->refresh()->completed_on->toDateString())->toBe('2026-10-21')
        ->and($job->paid_on->toDateString())->toBe('2026-10-22');

    // Reopening the job clears the day it finished.
    $this->actingAs($this->admin)
        ->post(route('maintenance.status', $job), ['maintenance_status_id' => ($this->status)('on_maintenance')->id, 'changed_on' => '2026-10-22'])
        ->assertSessionHasNoErrors();

    expect($job->refresh()->completed_on)->toBeNull()
        ->and($job->updates()->count())->toBe(4);
});

test('lists only the company\'s jobs, filtered by status, with the money spent this month', function () {
    MaintenanceJob::factory()->inRoom($this->room)->create(['title' => 'Leaking tap']);
    MaintenanceJob::factory()->inRoom($this->room)->completed(450)->create(['reported_on' => '2026-10-05', 'title' => 'Door lock']);
    MaintenanceJob::factory()->create(['title' => 'Another company\'s job']);

    $this->actingAs($this->admin)
        ->get(route('maintenance.index', ['status' => ['submitted']]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Maintenance/Index')
            ->has('jobs.data', 1)
            ->where('jobs.data.0.title', 'Leaking tap')
            ->where('jobs.data.0.unit.number', '101')
            ->where('summary.open', 1)
            ->where('summary.spentThisMonth', 450)
            ->where('summary.unpaid.count', 1)
        );
});

test('another company\'s job and its invoice are not found', function () {
    $job = MaintenanceJob::factory()->completed()->create(['invoice_path' => 'maintenance/x/invoice.pdf']);
    Storage::disk(MaintenanceJob::INVOICE_DISK)->put($job->invoice_path, 'pdf');

    $this->actingAs($this->admin)->get(route('maintenance.show', $job))->assertNotFound();
    $this->actingAs($this->admin)->get(route('maintenance.invoice', $job))->assertNotFound();
    $this->actingAs($this->admin)->put(route('maintenance.update', $job), maintenanceInput())->assertNotFound();

    $owner = User::factory()->create(['company_id' => $job->company_id]);
    $this->actingAs($owner)->get(route('maintenance.invoice', $job))->assertOk();
});

test('every maintenance page opens for a member of the company', function () {
    $job = MaintenanceJob::factory()->inRoom($this->room)->completed()->create();

    foreach ([route('maintenance.index') => 'Maintenance/Index', route('maintenance.create', ['property' => $this->property->id, 'room' => $this->room->id]) => 'Maintenance/Form', route('maintenance.show', $job) => 'Maintenance/Show', route('maintenance.edit', $job) => 'Maintenance/Form'] as $url => $component) {
        $this->actingAs($this->admin)->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->component($component));
    }

    $this->actingAs($this->admin)
        ->get(route('maintenance.create', ['property' => $this->property->id, 'room' => $this->room->id]))
        ->assertInertia(fn (Assert $page) => $page->where('defaults.unit_type', 'room')->where('defaults.room_id', $this->room->id));
});

test('lets an admin add a maintenance status with what it means, and keeps one in use', function () {
    $member = User::factory()->create(['company_id' => $this->company->id, 'is_admin' => false]);

    $this->actingAs($member)
        ->post(route('configuration.maintenance-statuses.store'), ['name' => 'Waiting for parts', 'stage' => 'in_progress', 'color' => 'amber'])
        ->assertForbidden();

    $this->actingAs($this->admin)
        ->post(route('configuration.maintenance-statuses.store'), ['name' => 'Waiting for parts', 'stage' => 'in_progress', 'color' => 'amber'])
        ->assertSessionHasNoErrors();

    $status = MaintenanceStatus::where('name', 'Waiting for parts')->sole();

    expect($status->slug)->toBe('waiting_for_parts')
        ->and($status->stage)->toBe('in_progress')
        ->and($status->color)->toBe('amber');

    $this->actingAs($this->admin)
        ->post(route('configuration.maintenance-statuses.store'), ['name' => 'Odd', 'stage' => 'paused', 'color' => 'pink'])
        ->assertSessionHasErrors(['stage', 'color']);

    MaintenanceJob::factory()->inRoom($this->room)->create(['maintenance_status_id' => $status->id]);

    $this->actingAs($this->admin)
        ->delete(route('configuration.maintenance-statuses.destroy', $status))
        ->assertSessionHasErrors('type');

    $this->actingAs($member)
        ->get(route('configuration.maintenance-statuses'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Configuration/Types')
            ->where('kind', 'maintenanceStatus')
            ->where('types', fn ($types) => collect($types)->firstWhere('slug', 'waiting_for_parts')['usage'] === 1)
        );
});

test('builds valid jobs from the factory', function () {
    $job = MaintenanceJob::factory()->completed()->create();

    expect($job->property)->toBeInstanceOf(Property::class)
        ->and($job->company_id)->toBe($job->property->company_id)
        ->and($job->status->isCompleted())->toBeTrue();
});
