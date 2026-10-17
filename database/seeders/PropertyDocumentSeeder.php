<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Three compliance documents for each demo property.
 *
 * Safe to re-run: a property keeps one document per type, updated in place.
 * Most dates are relative to the day the seeder runs, and one certificate
 * always expires within a month so expiry alerts have something to show. The
 * title deed never expires. Every document points at the same placeholder PDF.
 * Requires PropertySeeder.
 */
class PropertyDocumentSeeder extends Seeder
{
    /**
     * Stand-in for an uploaded file until real uploads exist.
     */
    public const PLACEHOLDER_FILE_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        foreach ($this->documentsByProperty() as $code => $documents) {
            $property = $company->properties()->where('code', $code)->firstOrFail();

            foreach ($documents as $document) {
                $property->documents()->updateOrCreate(
                    ['document_type' => $document['document_type']],
                    [...$document, 'file_url' => self::PLACEHOLDER_FILE_URL],
                );
            }
        }
    }

    /**
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function documentsByProperty(): array
    {
        return [
            PropertySeeder::AL_QUOZ => [
                [
                    'document_type' => 'title_deed',
                    'title' => 'Title Deed',
                    'document_number' => 'TD-2019-536128',
                    'issued_on' => '2019-03-14',
                    'expires_on' => null,
                    'notes' => 'Freehold title registered with the Dubai Land Department. Does not expire.',
                ],
                [
                    'document_type' => 'civil_defence_certificate',
                    'title' => 'Civil Defence Fire Safety Certificate',
                    'document_number' => 'CD-2025-77412',
                    'issued_on' => today()->subMonths(11),
                    'expires_on' => today()->addDays(30),
                    'notes' => 'Renewal inspection is due next month.',
                ],
                [
                    'document_type' => 'insurance_policy',
                    'title' => 'Property All-Risk Insurance',
                    'document_number' => 'POL-AR-2026-30981',
                    'issued_on' => today()->subMonths(4),
                    'expires_on' => today()->addMonths(8),
                    'notes' => 'Covers the buildings and fixtures against fire, flood and theft.',
                ],
            ],
            PropertySeeder::JEBEL_ALI => [
                [
                    'document_type' => 'tenancy_contract',
                    'title' => 'Tenancy Contract (Ejari)',
                    'document_number' => 'EJR-2026-114782',
                    'issued_on' => '2026-01-01',
                    'expires_on' => '2028-12-31',
                    'notes' => 'Three-year lease registered on Ejari.',
                ],
                [
                    'document_type' => 'civil_defence_certificate',
                    'title' => 'Civil Defence Fire Safety Certificate',
                    'document_number' => 'CD-2026-10458',
                    'issued_on' => today()->subMonths(2),
                    'expires_on' => today()->addMonths(10),
                    'notes' => 'Annual inspection passed without remarks.',
                ],
                [
                    'document_type' => 'insurance_policy',
                    'title' => 'Property All-Risk Insurance',
                    'document_number' => 'POL-AR-2026-41277',
                    'issued_on' => today()->subMonths(2),
                    'expires_on' => today()->addMonths(10),
                    'notes' => 'Tenant liability cover as required by the landlord.',
                ],
            ],
        ];
    }
}
