<?php

use App\Models\Company;
use App\Models\MaintenanceContract;
use App\Models\MaintenanceVisit;
use App\Models\User;
use Database\Seeders\PortfolioSeeder;
use Database\Seeders\PropertySeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(now()->setDate(2026, 10, 22)->setTime(10, 0));
    $this->seed(PortfolioSeeder::class);
    Storage::fake(MaintenanceVisit::REPORT_DISK);

    $this->admin = User::where('email', 'omar.rahman@horizonfm.test')->sole();
    $this->company = Company::findOrFail($this->admin->company_id);
    $this->property = $this->company->properties()->where('code', PropertySeeder::AL_QUOZ)->sole();
    $this->contract = MaintenanceContract::factory()->create([
        'property_id' => $this->property->id,
        'service' => 'pest_control',
        'vendor_name' => 'Shield Pest Control Services',
        'start_date' => '2026-07-01',
        'end_date' => '2027-06-30',
        'visit_frequency' => 'monthly',
        'visit_alert_days' => 3,
        'coverage' => ['bed_bugs', 'rodents'],
    ]);
});

/**
 * A year's pest control contract for the demo camp, paid by cheque every four months.
 *
 * @return array<string, mixed>
 */
function pestControlInput(array $overrides = []): array
{
    return [
        'property_id' => test()->company->properties()->where('code', PropertySeeder::JEBEL_ALI)->value('id'),
        'vendor_name' => 'Shield Pest Control Services',
        'start_date' => '2026-11-01',
        'end_date' => '2027-10-31',
        'contract_value' => 9000,
        'payment_terms' => 'four_monthly',
        'visit_frequency' => 'monthly',
        'visit_alert_days' => 2,
        'coverage' => ['crawling_insects', 'bed_bugs'],
        ...$overrides,
    ];
}

test('adds the contractor\'s visits, only within the contract', function () {
    $this->actingAs($this->admin)
        ->post(route('amc-visits.store', $this->contract), ['visits' => [
            ['scheduled_on' => '2026-11-10', 'scheduled_time' => '09:30'],
            ['scheduled_on' => '2026-12-10'],
        ], 'notes' => 'Job card 4471'])
        ->assertSessionHasNoErrors();

    expect($this->contract->visits()->orderBy('scheduled_on')->get())
        ->toHaveCount(2)
        ->sequence(
            fn ($visit) => $visit->scheduled_on->toDateString()->toBe('2026-11-10')->scheduled_time->toStartWith('09:30')->status->toBe('scheduled')->notes->toBe('Job card 4471'),
            fn ($visit) => $visit->scheduled_on->toDateString()->toBe('2026-12-10')->company_id->toBe($this->company->id),
        );

    $this->actingAs($this->admin)
        ->post(route('amc-visits.store', $this->contract), ['visits' => [['scheduled_on' => '2027-07-10']]])
        ->assertSessionHasErrors(['visits.0.scheduled_on' => 'Visits must fall within the contract, from 1 Jul 2026 to 30 Jun 2027.']);

    $other = MaintenanceContract::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('amc-visits.store', $other), ['visits' => [['scheduled_on' => today()->toDateString()]]])
        ->assertNotFound();
});

test('marks a visit done with its service report, which becomes the contract\'s last visit', function () {
    $visit = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(-1)->create();

    $this->actingAs($this->admin)
        ->post(route('amc-visits.status', $visit), [
            'status' => 'done',
            'completed_on' => '2026-10-21',
            'technician_name' => 'Joseph Mathew',
            'report_number' => 'SPC-SR-2231',
            'report' => UploadedFile::fake()->create('service-report.pdf', 80, 'application/pdf'),
        ])
        ->assertSessionHasNoErrors();

    $visit->refresh();

    expect($visit->status)->toBe('done')
        ->and($visit->completed_on->toDateString())->toBe('2026-10-21')
        ->and($visit->technician_name)->toBe('Joseph Mathew')
        ->and($visit->report_name)->toBe('service-report.pdf')
        ->and($visit->updated_by)->toBe($this->admin->id)
        ->and($this->contract->refresh()->last_visit_on->toDateString())->toBe('2026-10-21');

    Storage::disk(MaintenanceVisit::REPORT_DISK)->assertExists($visit->report_path);
    $this->actingAs($this->admin)->get(route('amc-visits.report', $visit))->assertOk();

    // A visit done can only go back on the schedule, which clears what was recorded.
    $this->actingAs($this->admin)
        ->post(route('amc-visits.status', $visit), ['status' => 'confirmed'])
        ->assertSessionHasErrors('status');

    $path = $visit->report_path;

    $this->actingAs($this->admin)
        ->post(route('amc-visits.status', $visit), ['status' => 'scheduled'])
        ->assertSessionHasNoErrors();

    expect($visit->refresh())->status->toBe('scheduled')->completed_on->toBeNull()->report_path->toBeNull();
    Storage::disk(MaintenanceVisit::REPORT_DISK)->assertMissing($path);

    $this->actingAs($this->admin)
        ->post(route('amc-visits.status', $visit), ['status' => 'done', 'completed_on' => '2026-10-25'])
        ->assertSessionHasErrors(['completed_on' => 'A visit cannot be done in the future.']);
});

test('flags visits inside their contract\'s alert window, and overdue ones, on the dashboard and in the notifications', function () {
    $overdue = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(-2)->create();
    $close = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(3)->create(['status' => 'confirmed']);
    MaintenanceVisit::factory()->for($this->contract, 'contract')->on(4)->create();
    MaintenanceVisit::factory()->for($this->contract, 'contract')->on(1)->done()->create();
    MaintenanceVisit::factory()->for($this->contract, 'contract')->on(1)->create(['status' => 'cancelled']);

    // A cancelled contract's visits are no longer expected.
    $cancelled = MaintenanceContract::factory()->create(['property_id' => $this->property->id, 'service' => 'water_tanks', 'coverage' => ['roof_tanks'], 'status' => 'cancelled']);
    MaintenanceVisit::factory()->for($cancelled, 'contract')->on(1)->create();

    $this->actingAs($this->admin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('visitAlerts', 2)
            ->where('visitAlerts.0.id', $overdue->id)
            ->where('visitAlerts.0.alert', 'overdue')
            ->where('visitAlerts.0.daysAway', -2)
            ->where('visitAlerts.1.id', $close->id)
            ->where('visitAlerts.1.alert', 'due')
            ->where('visitAlerts.1.contract.service', 'pest_control')
            ->where('visitAlerts.1.contract.property.name', $this->property->name)
            ->where('notifications', fn ($notifications) => collect($notifications)
                ->filter(fn (array $notification) => str_starts_with($notification['type'], 'visit_'))
                ->map(fn (array $notification) => [$notification['type'], $notification['days'], $notification['service']])
                ->values()
                ->all() === [['visit_overdue', -2, 'pest_control'], ['visit_due', 3, 'pest_control']])
        );

    // Dealing with a visit takes it off the alert.
    $this->actingAs($this->admin)->post(route('amc-visits.status', $overdue), ['status' => 'missed']);

    $this->actingAs($this->admin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->has('visitAlerts', 1)->where('visitAlerts.0.id', $close->id));
});

test('moves a missed visit to another day, remembering the day first planned', function () {
    $visit = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(-1)->create(['status' => 'missed']);

    $this->actingAs($this->admin)
        ->put(route('amc-visits.reschedule', $visit), ['scheduled_on' => '2026-10-28', 'scheduled_time' => '14:00'])
        ->assertSessionHasNoErrors();

    expect($visit->refresh())
        ->scheduled_on->toDateString()->toBe('2026-10-28')
        ->rescheduled_from->toDateString()->toBe('2026-10-21')
        ->status->toBe('scheduled');

    $visit->forceFill(['status' => 'cancelled'])->save();

    $this->actingAs($this->admin)
        ->put(route('amc-visits.reschedule', $visit), ['scheduled_on' => '2026-10-29'])
        ->assertSessionHasErrors('scheduled_on');

    // A visit added by mistake can be removed; one done stays on record.
    $this->actingAs($this->admin)->delete(route('amc-visits.destroy', $visit))->assertRedirect();
    expect(MaintenanceVisit::find($visit->id))->toBeNull();

    $done = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(-5)->done()->create();
    $this->actingAs($this->admin)->delete(route('amc-visits.destroy', $done))->assertStatus(422);
});

test('lists every visit across the contracts, those needing attention first', function () {
    $close = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(2)->create();
    $later = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(20)->create();
    $done = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(-30)->done()->create();
    MaintenanceVisit::factory()->for(MaintenanceContract::factory(), 'contract')->create();

    $this->actingAs($this->admin)
        ->get(route('amc-visits.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Amcs/Visits')
            ->has('visits.data', 3)
            ->where('visits.data.0.id', $close->id)
            ->where('visits.data.1.id', $later->id)
            ->where('visits.data.2.id', $done->id)
            ->where('summary.due', 1)
            ->where('summary.overdue', 0)
            ->where('summary.next.id', $close->id)
            ->where('facets.service', fn ($facets) => collect($facets)->firstWhere('value', 'pest_control')['count'] === 3)
        );

    $this->actingAs($this->admin)
        ->get(route('amc-visits.index', ['due' => ['alert']]))
        ->assertInertia(fn (Assert $page) => $page->has('visits.data', 1)->where('visits.data.0.id', $close->id));

    $this->actingAs($this->admin)
        ->get(route('amc-visits.index', ['status' => ['done'], 'search' => 'Shield']))
        ->assertInertia(fn (Assert $page) => $page->has('visits.data', 1)->where('visits.data.0.id', $done->id));
});

test('pays a contract every four months by three cheques to the contractor', function () {
    $this->actingAs($this->admin)
        ->post(route('amcs.pest-control.store'), pestControlInput(['contract_value' => 10000, 'cheques' => [
            ['key' => 'rent:1', 'cheque_number' => '000451', 'bank_name' => 'Emirates NBD'],
        ]]))
        ->assertSessionHasNoErrors();

    $contract = MaintenanceContract::where('service', 'pest_control')->latest('id')->first();
    $cheques = $contract->cheques()->orderBy('sequence')->get();

    expect($contract->visit_alert_days)->toBe(2)
        ->and($cheques)->toHaveCount(3)
        ->and($cheques->pluck('cheque_date')->map->toDateString()->all())->toBe(['2026-11-01', '2027-03-01', '2027-07-01'])
        ->and($cheques->pluck('amount')->map(fn ($amount) => (float) $amount)->all())->toBe([3333.33, 3333.33, 3333.34])
        ->and($cheques->pluck('direction')->unique()->all())->toBe(['issued'])
        ->and($cheques[0]->status)->toBe('issued')
        ->and($cheques[1]->status)->toBe('pending')
        ->and($cheques[2]->period_end->toDateString())->toBe('2027-10-31');

    $this->actingAs($this->admin)
        ->get(route('cheques.index', ['search' => 'Shield']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('cheques.data', 3)
            ->where('cheques.data.0.agreement', ['type' => 'maintenance_contract', 'id' => $contract->id, 'number' => $contract->contract_number, 'service' => 'pest_control'])
            ->where('cheques.data.0.party', ['type' => 'vendor', 'id' => null, 'name' => 'Shield Pest Control Services'])
        );

    // A cleared contractor cheque is money out, under maintenance contracts.
    $cheques[0]->clear(today());

    $this->actingAs($this->admin)
        ->get(route('payments.overview', ['period' => 'this_month', 'category' => ['maintenance_contract']]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('totals.maintenance_contract', ['count' => 1, 'amount' => 3333.33])
            ->where('transactions.data.0.party', 'Shield Pest Control Services')
            ->where('transactions.data.0.parentId', $contract->id)
        );

    $this->actingAs($this->admin)->get(route('amcs.contract', $contract))->assertRedirect(route('amcs.pest-control.show', $contract));
});

test('a contract paid per visit has no cheque schedule', function () {
    $this->actingAs($this->admin)
        ->post(route('amcs.pest-control.store'), pestControlInput(['payment_terms' => 'per_visit']))
        ->assertSessionHasNoErrors();

    expect(MaintenanceContract::where('service', 'pest_control')->latest('id')->first()->cheques()->count())->toBe(0);
});

test('shows a contract\'s visit schedule and sets up the cheques of one added before they were tracked', function () {
    MaintenanceVisit::factory()->for($this->contract, 'contract')->on(-20)->done()->create();
    $next = MaintenanceVisit::factory()->for($this->contract, 'contract')->on(1)->create();

    $this->actingAs($this->admin)
        ->get(route('amcs.pest-control.show', $this->contract))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Amcs/Show')
            ->has('visits', 2)
            ->where('visitStats', ['total' => 2, 'done' => 1, 'open' => 1, 'overdue' => 0, 'due' => 1])
            ->where('contract.nextVisitOn', $next->scheduled_on->toDateString())
            ->where('contract.hasSchedule', true)
            ->where('contract.paysByCheque', true)
            // The draft for more visits carries on monthly from the last one, to the end of the term.
            ->where('contract.suggestedVisits', ['2026-11-23', '2026-12-23', '2027-01-23', '2027-02-23', '2027-03-23', '2027-04-23', '2027-05-23', '2027-06-23'])
            ->has('cheques', 0)
        );

    $this->actingAs($this->admin)->post(route('amcs.cheques.store', $this->contract))->assertRedirect();

    expect($this->contract->cheques()->count())->toBe(4);
});
