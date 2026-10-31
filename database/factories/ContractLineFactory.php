<?php

namespace Database\Factories;

use App\Models\Contract;
use App\Models\ContractLine;
use App\Models\Property;
use App\Models\Room;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ContractLine>
 */
class ContractLineFactory extends Factory
{
    /**
     * Define the model's default state: one whole room in a property of the
     * contract's company, for the whole term.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'contract_id' => Contract::factory(),
            // Lines must share their contract's company (enforced by composite foreign keys).
            'company_id' => fn (array $attributes) => Contract::query()->whereKey($attributes['contract_id'])->value('company_id'),
            'property_id' => fn (array $attributes) => Property::factory()->create(['company_id' => $attributes['company_id']])->id,
            'unit_type' => 'room',
            'room_id' => fn (array $attributes) => $attributes['unit_type'] === 'room'
                ? Room::factory()->create(['property_id' => $attributes['property_id']])->id
                : null,
            'monthly_rate' => 2000,
            'vat_rate' => 0,
            'start_date' => fn (array $attributes) => Contract::query()->whereKey($attributes['contract_id'])->value('start_date'),
            'end_date' => fn (array $attributes) => Contract::query()->whereKey($attributes['contract_id'])->value('end_date'),
        ];
    }
}
