<?php

namespace Database\Factories;

use App\Models\Cheque;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * Cheques belong to an agreement; give one with forAgreement().
 *
 * @extends Factory<Cheque>
 */
class ChequeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'purpose' => 'rent',
            'sequence' => 1,
            'cheque_date' => today(),
            'amount' => fake()->randomElement([1500, 4500, 12000, 45000]),
            'status' => 'pending',
        ];
    }

    /**
     * A cheque under a contract (received) or a head lease (issued).
     */
    public function forAgreement(Model $agreement): static
    {
        return $this->state(fn () => [
            'company_id' => $agreement->company_id,
            'direction' => $agreement->chequeDirection(),
            'chequeable_type' => $agreement->getMorphClass(),
            'chequeable_id' => $agreement->getKey(),
        ]);
    }

    /**
     * With its number and bank recorded: in hand (received) or handed over (issued).
     */
    public function held(): static
    {
        return $this->state(fn () => [
            'cheque_number' => fake()->unique()->numerify('######'),
            'bank_name' => fake()->randomElement(['Emirates NBD', 'Mashreq', 'RAKBANK']),
        ])->afterMaking(fn (Cheque $cheque) => $cheque->status = $cheque->heldStatus());
    }
}
