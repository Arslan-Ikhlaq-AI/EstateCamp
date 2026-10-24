<?php

namespace Database\Seeders;

use App\Models\MaintenanceCategory;
use App\Models\MaintenanceJob;
use App\Models\MaintenanceStatus;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * Problems reported at the demo properties, at every stage: just submitted,
 * being fixed, fixed but not paid yet, and fixed and paid with the invoice
 * on file. Each job's history is built by moving it through its statuses.
 *
 * Safe to re-run: a job is matched on its title within the property.
 * Requires PortfolioSeeder.
 */
class MaintenanceJobSeeder extends Seeder
{
    private const DEMO_INVOICE = 'images/demo/maintenance-invoice.svg';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $user = $company->users()->orderBy('id')->first();
        $statuses = MaintenanceStatus::query()->get()->keyBy('slug');
        $categoryIds = MaintenanceCategory::query()->pluck('id', 'slug');

        foreach ($this->jobs() as $row) {
            $property = $company->properties()->where('code', $row['property'])->firstOrFail();

            if ($company->maintenanceJobs()->where('property_id', $property->id)->where('title', $row['title'])->exists()) {
                continue;
            }

            $room = isset($row['room']) ? $property->rooms()->where('room_number', $row['room'])->firstOrFail() : null;
            $reportedOn = today()->subDays($row['reported']);

            $job = new MaintenanceJob([
                ...array_intersect_key($row, array_flip(['location', 'title', 'description', 'priority', 'reported_by', 'vendor_name', 'vendor_phone', 'notes'])),
                'maintenance_category_id' => $categoryIds->get($row['category']),
                'reported_on' => $reportedOn,
            ]);
            $job->placeAt($property, $room ? 'room' : 'property', $room?->id);
            $job->forceFill(['job_number' => MaintenanceJob::nextNumber($company->id, $reportedOn), 'created_by' => $user?->id]);

            foreach ($row['steps'] as [$slug, $daysAgo, $note]) {
                $job->moveTo($statuses->get($slug), today()->subDays($daysAgo), $note, $user);
            }

            if (isset($row['cost'])) {
                $job->recordCost($row['cost']);
                $this->attachDemoInvoice($job);
            }
        }
    }

    /**
     * Give a finished job the demo invoice, as if photographed.
     */
    private function attachDemoInvoice(MaintenanceJob $job): void
    {
        $path = "maintenance/{$job->company_id}/{$job->id}/invoice-demo.svg";
        Storage::disk(MaintenanceJob::INVOICE_DISK)->put($path, file_get_contents(public_path(self::DEMO_INVOICE)));
        $job->forceFill(['invoice_path' => $path, 'invoice_name' => 'invoice.svg'])->save();
    }

    /**
     * The demo jobs. `reported` and each step's date are days before today;
     * steps are [status slug, days ago, note].
     *
     * @return list<array<string, mixed>>
     */
    private function jobs(): array
    {
        return [
            [
                'property' => PropertySeeder::AL_QUOZ,
                'location' => 'Pump room, ground floor',
                'category' => 'water_pump_motor',
                'title' => 'Water motor burnt out',
                'description' => 'The main water motor stopped overnight; residents have no water pressure on the upper floors.',
                'priority' => 'urgent',
                'reported_by' => 'Night watchman',
                'vendor_name' => 'Al Noor Technical Services',
                'vendor_phone' => '+971 50 412 7788',
                'reported' => 2,
                'steps' => [['submitted', 2, null], ['on_maintenance', 1, 'Motor taken for rewinding; a spare pump is running for now.']],
            ],
            [
                'property' => PropertySeeder::AL_QUOZ,
                'room' => '202',
                'category' => 'air_conditioning',
                'title' => 'AC unit not cooling',
                'description' => 'Split unit blowing warm air. Compressor suspected.',
                'priority' => 'high',
                'reported_by' => 'Room leader',
                'vendor_name' => 'Cool Breeze AC Maintenance',
                'vendor_phone' => '+971 4 338 9021',
                'reported' => 6,
                'steps' => [['submitted', 6, null], ['on_maintenance', 4, 'Compressor ordered; room emptied until it is replaced.']],
            ],
            [
                'property' => PropertySeeder::AL_QUOZ,
                'room' => '101',
                'category' => 'furniture_beds',
                'title' => 'Two bunk bed frames broken',
                'description' => 'Welds on beds 3 and 4 have cracked.',
                'priority' => 'normal',
                'reported_by' => 'Camp boss',
                'vendor_name' => 'Gulf Steel Works',
                'vendor_phone' => '+971 55 901 2234',
                'reported' => 14,
                'steps' => [['submitted', 14, null], ['on_maintenance', 13, null], ['maintenance_done', 11, 'Both frames re-welded and painted.']],
                'cost' => ['amount' => 650, 'payment_method' => 'cash', 'invoice_number' => 'GSW-2291'],
            ],
            [
                'property' => PropertySeeder::JEBEL_ALI,
                'room' => '103',
                'category' => 'plumbing',
                'title' => 'Bathroom tap leaking',
                'priority' => 'low',
                'reported_by' => 'Resident',
                'vendor_name' => 'In-house technician',
                'reported' => 18,
                'steps' => [['submitted', 18, null], ['maintenance_done', 17, 'Cartridge replaced.'], ['payment_done', 16, null]],
                'cost' => ['amount' => 180, 'payment_method' => 'cash', 'paid_on' => today()->subDays(16)->toDateString(), 'invoice_number' => 'PL-0457'],
            ],
            [
                'property' => PropertySeeder::JEBEL_ALI,
                'location' => 'Roof',
                'category' => 'painting_civil',
                'title' => 'Water seepage from the roof',
                'description' => 'Damp patches on the second-floor corridor ceiling after the rain.',
                'priority' => 'high',
                'reported_by' => 'Facility supervisor',
                'vendor_name' => 'Shield Waterproofing L.L.C.',
                'vendor_phone' => '+971 4 885 6612',
                'reported' => 45,
                'steps' => [['submitted', 45, null], ['on_maintenance', 40, null], ['maintenance_done', 33, 'Roof membrane redone over 60 m².'], ['payment_done', 30, 'Paid by cheque.']],
                'cost' => ['amount' => 2400, 'payment_method' => 'cheque', 'paid_on' => today()->subDays(30)->toDateString(), 'invoice_number' => 'SW-1180'],
            ],
            [
                'property' => PropertySeeder::JEBEL_ALI,
                'location' => 'Second floor corridor',
                'category' => 'electrical',
                'title' => 'Corridor lights flickering',
                'priority' => 'normal',
                'reported_by' => 'Reception',
                'reported' => 1,
                'steps' => [['submitted', 1, null]],
            ],
        ];
    }
}
