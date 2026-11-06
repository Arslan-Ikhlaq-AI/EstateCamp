<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Company;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;

/**
 * How a contract's money divides among the properties it rents in, so that
 * every page counts a property's money the same way and the properties add
 * up to the company.
 */
trait SharesContractMoney
{
    /**
     * Each contract's properties and the part of its money each one takes:
     * its lines' share of the contract's monthly rent, or of its lines when
     * no rent is set. One row per contract and property (`contract_id`,
     * `property_id`, `share`), or per contract given `$propertyId`, leaving
     * out contracts that do not rent there.
     */
    protected function contractShares(Company $company, ?int $propertyId = null): QueryBuilder
    {
        $lines = fn () => DB::table('contract_lines')
            ->where('company_id', $company->id)
            ->groupBy('contract_id')
            ->selectRaw('contract_id, sum(monthly_rate) as rent, count(*) as line_count');

        return DB::query()
            ->fromSub($lines()->addSelect('property_id')->groupBy('property_id'), 'parts')
            ->joinSub($lines(), 'whole', 'whole.contract_id', '=', 'parts.contract_id')
            ->when($propertyId !== null, fn (QueryBuilder $query) => $query->where('parts.property_id', $propertyId))
            ->selectRaw('parts.contract_id, parts.property_id, case when whole.rent > 0 then parts.rent * 1.0 / whole.rent else parts.line_count * 1.0 / whole.line_count end as share');
    }
}
