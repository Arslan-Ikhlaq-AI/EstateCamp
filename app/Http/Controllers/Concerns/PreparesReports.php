<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Company;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * What every report carries besides its figures: the company's letterhead,
 * when and by whom it was prepared, and the months it charts.
 */
trait PreparesReports
{
    /**
     * The company as a report's letterhead names it, with the currency its
     * figures are in.
     *
     * @return array{name: string, legalName: ?string, logoUrl: ?string, address: list<string>, phone: ?string, email: ?string, taxNumber: ?string, currency: string}
     */
    protected function reportCompany(Company $company): array
    {
        return [
            'name' => $company->name,
            'legalName' => $company->legal_name,
            'logoUrl' => $company->logo_url,
            'address' => array_values(array_filter([$company->address_line_1, $company->address_line_2, $company->city])),
            'phone' => $company->phone,
            'email' => $company->email,
            'taxNumber' => $company->tax_registration_number,
            'currency' => $company->default_currency,
        ];
    }

    /**
     * When the report was prepared, in the company's time, and by whom.
     *
     * @return array{date: string, time: string, by: string}
     */
    protected function preparedBy(Company $company, Request $request): array
    {
        $now = $company->localNow();

        return ['date' => $now->toDateString(), 'time' => $now->format('H:i'), 'by' => $request->user()->name];
    }

    /**
     * The `$count` months (`Y-m`) up to and including the month `$lastDay`
     * falls in, or this month when there is none (all time).
     *
     * @return list<string>
     */
    protected function monthsEndingWith(?string $lastDay, int $count): array
    {
        $end = CarbonImmutable::parse($lastDay ?? today())->startOfMonth();

        return array_map(fn (int $offset) => $end->subMonthsNoOverflow($count - 1 - $offset)->format('Y-m'), range(0, $count - 1));
    }
}
