<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Property;
use App\Models\RegionalOffice;
use App\Models\StaffMember;
use App\Models\StaffRole;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Someone working at the head office in a head-office role. Place them with
 * atOffice() or atProperty(), or mark them as gone with left().
 *
 * @extends Factory<StaffMember>
 */
class StaffMemberFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'employee_number' => fn () => 'EMP-'.now()->year.'-'.fake()->unique()->numerify('####'),
            'full_name' => fake()->name('male'),
            'gender' => 'male',
            'nationality' => fake()->randomElement(['Indian', 'Pakistani', 'Filipino', 'Egyptian', 'Emirati']),
            'phone' => '+971 5'.fake()->numerify('# ### ####'),
            // Roles are reference rows inserted by their migration.
            'staff_role_id' => fn () => StaffRole::query()->where('level', 'head_office')->inRandomOrder()->value('id'),
            'work_level' => 'head_office',
            'employment_type' => 'full_time',
            'joined_on' => today()->subYears(2)->startOfMonth(),
            'status' => 'active',
            'basic_salary' => 3000,
            'housing_allowance' => 0,
            'transport_allowance' => 0,
            'other_allowance' => 0,
            'salary_payment_method' => 'bank_transfer',
        ];
    }

    /**
     * Working at one of the company's regional offices, in a regional role.
     */
    public function atOffice(RegionalOffice $office): static
    {
        return $this->state(fn () => [
            'company_id' => $office->company_id,
            'staff_role_id' => StaffRole::query()->where('level', 'regional')->inRandomOrder()->value('id'),
            'work_level' => 'regional',
            'regional_office_id' => $office->id,
        ]);
    }

    /**
     * Working at a camp or building, in a site role.
     */
    public function atProperty(Property $property): static
    {
        return $this->state(fn () => [
            'company_id' => $property->company_id,
            'staff_role_id' => StaffRole::query()->where('level', 'site')->inRandomOrder()->value('id'),
            'work_level' => 'site',
            'property_id' => $property->id,
        ]);
    }

    /**
     * Resigned, leaving on `$leftOn` (yesterday by default).
     */
    public function left(?string $leftOn = null): static
    {
        return $this->state(fn () => ['status' => 'resigned', 'left_on' => $leftOn ?? today()->subDay()->toDateString()]);
    }
}
