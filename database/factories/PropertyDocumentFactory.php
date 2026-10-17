<?php

namespace Database\Factories;

use App\Models\Property;
use App\Models\PropertyDocument;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PropertyDocument>
 */
class PropertyDocumentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $issuedOn = fake()->dateTimeBetween('-2 years', '-1 month');

        return [
            'property_id' => Property::factory(),
            'document_type' => fake()->randomElement(['civil_defence_certificate', 'insurance_policy', 'tenancy_contract']),
            'title' => fake()->sentence(3),
            'document_number' => fake()->unique()->numerify('DOC-########'),
            'file_url' => 'https://example.test/documents/'.fake()->uuid().'.pdf',
            'issued_on' => $issuedOn,
            'expires_on' => fake()->dateTimeBetween($issuedOn, '+2 years'),
        ];
    }
}
