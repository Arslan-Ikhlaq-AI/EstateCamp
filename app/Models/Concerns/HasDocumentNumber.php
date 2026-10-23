<?php

namespace App\Models\Concerns;

use Carbon\CarbonInterface;

/**
 * A readable per-company document number such as CTR-2026-0007. The model
 * declares NUMBER_PREFIX and NUMBER_COLUMN; a unique index on
 * (company_id, column) guards against two saves taking the same number.
 * A model with a second series, such as a maintenance job's payment
 * voucher, numbers it with nextNumberIn().
 */
trait HasDocumentNumber
{
    /**
     * The next free number for the company in the year of `$date` (today by default).
     */
    public static function nextNumber(int $companyId, ?CarbonInterface $date = null): string
    {
        return static::nextNumberIn(static::NUMBER_COLUMN, static::NUMBER_PREFIX, $companyId, $date);
    }

    /**
     * The next free number in `$column` for the company, such as PV-2026-0004.
     */
    protected static function nextNumberIn(string $column, string $prefix, int $companyId, ?CarbonInterface $date = null): string
    {
        $prefix = $prefix.'-'.($date ?? now())->year.'-';

        $last = static::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where($column, 'like', $prefix.'%')
            ->max($column);

        $next = $last === null ? 1 : (int) substr($last, strlen($prefix)) + 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
