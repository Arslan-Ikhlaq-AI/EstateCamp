<?php

namespace App\Models\Concerns;

use Carbon\CarbonInterface;

/**
 * A readable per-company document number such as CTR-2026-0007. The model
 * declares NUMBER_PREFIX and NUMBER_COLUMN; a unique index on
 * (company_id, column) guards against two saves taking the same number.
 */
trait HasDocumentNumber
{
    /**
     * The next free number for the company in the year of `$date` (today by default).
     */
    public static function nextNumber(int $companyId, ?CarbonInterface $date = null): string
    {
        $prefix = static::NUMBER_PREFIX.'-'.($date ?? now())->year.'-';

        $last = static::query()
            ->withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where(static::NUMBER_COLUMN, 'like', $prefix.'%')
            ->max(static::NUMBER_COLUMN);

        $next = $last === null ? 1 : (int) substr($last, strlen($prefix)) + 1;

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
