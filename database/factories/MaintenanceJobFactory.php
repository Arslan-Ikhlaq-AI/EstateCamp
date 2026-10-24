<?php

namespace Database\Factories;

use App\Models\MaintenanceCategory;
use App\Models\MaintenanceJob;
use App\Models\MaintenanceStatus;
use App\Models\Property;
use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A problem reported at a property, still in the first open status. Give a
 * room with inRoom(), or finish the work with completed().
 *
 * @extends Factory<MaintenanceJob>
 */
class MaintenanceJobFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'property_id' => Property::factory(),
            // Jobs must share their property's company (enforced by a composite foreign key).
            'company_id' => fn (array $attributes) => Property::query()->whereKey($attributes['property_id'])->value('company_id'),
            'job_number' => fn () => 'MNT-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'unit_type' => 'property',
            // Categories and statuses are reference rows inserted by their migrations.
            'maintenance_category_id' => fn () => MaintenanceCategory::query()->inRandomOrder()->value('id'),
            'maintenance_status_id' => fn () => MaintenanceStatus::query()->where('stage', 'open')->orderBy('sort_order')->value('id'),
            'title' => fake()->randomElement(['Water motor not starting', 'Leaking tap in the bathroom', 'Broken bed frame', 'AC not cooling', 'Door lock jammed']),
            'description' => fake()->sentence(),
            'priority' => 'normal',
            'reported_on' => today()->subDays(fake()->numberBetween(0, 20)),
        ];
    }

    /**
     * In one room of the property.
     */
    public function inRoom(Room $room): static
    {
        return $this->state(fn () => [
            'company_id' => $room->company_id,
            'property_id' => $room->property_id,
            'unit_type' => 'room',
            'room_id' => $room->id,
        ]);
    }

    /**
     * The work finished, at `$amount`, in the first finished status.
     */
    public function completed(float $amount = 450): static
    {
        return $this->state(fn (array $attributes) => [
            'maintenance_status_id' => MaintenanceStatus::query()->where('stage', 'completed')->orderBy('sort_order')->value('id'),
            'started_on' => $attributes['reported_on'],
            'completed_on' => $attributes['reported_on'],
            'vendor_name' => fake()->company(),
            'amount' => $amount,
            'payment_method' => 'cash',
            'invoice_number' => fake()->numerify('INV-####'),
        ]);
    }
}
