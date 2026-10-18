<?php

namespace Database\Factories;

use App\Models\Contract;
use App\Models\ContractDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ContractDocument>
 */
class ContractDocumentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $issuedOn = fake()->dateTimeBetween('-1 year', 'now');

        return [
            'contract_id' => Contract::factory(),
            'document_type' => fake()->randomElement(ContractDocument::TYPES),
            'title' => fake()->optional()->sentence(3),
            'document_number' => fake()->bothify('DOC-####-??'),
            'file_url' => '/storage/contracts/'.fake()->uuid().'.pdf',
            'issued_on' => $issuedOn,
            'expires_on' => fake()->dateTimeBetween($issuedOn, '+2 years'),
        ];
    }
}
