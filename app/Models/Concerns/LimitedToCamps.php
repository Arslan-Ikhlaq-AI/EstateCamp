<?php

namespace App\Models\Concerns;

use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;

/**
 * A record that belongs to one of the company's camps (its properties).
 * While an area manager or camp boss is signed in, every query for it,
 * route model binding and related counts included, sees only the records
 * at the camps given to them, so another camp's record is not found; and
 * saving a record at another camp is refused. Everyone else, and the
 * console and queue, see every camp.
 *
 * A model where the record sits at a property of its own (`property_id`)
 * needs nothing more; others say how they reach their camp by overriding
 * limitToCamps() and isAtCamps().
 */
trait LimitedToCamps
{
    /**
     * Narrow queries to the signed-in user's camps, and refuse saving a
     * record at another one.
     */
    public static function bootLimitedToCamps(): void
    {
        static::addGlobalScope('camps', function (Builder $query): void {
            $propertyIds = User::signedInCampIds();

            if ($propertyIds !== null) {
                $query->getModel()->limitToCamps($query, $propertyIds);
            }
        });

        static::saving(function (self $record): void {
            $propertyIds = User::signedInCampIds();

            if ($propertyIds !== null && ! $record->isAtCamps($propertyIds)) {
                throw new AuthorizationException('This belongs to a camp you do not look after.');
            }
        });
    }

    /**
     * Narrow `$query` to the records at `$propertyIds`.
     *
     * @param  Builder<static>  $query
     * @param  list<int>  $propertyIds
     */
    public function limitToCamps(Builder $query, array $propertyIds): void
    {
        $query->whereIn($this->qualifyColumn('property_id'), $propertyIds);
    }

    /**
     * Whether this record, about to be saved, is at one of `$propertyIds`.
     *
     * @param  list<int>  $propertyIds
     */
    public function isAtCamps(array $propertyIds): bool
    {
        return in_array((int) $this->property_id, $propertyIds, true);
    }
}
