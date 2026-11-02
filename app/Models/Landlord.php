<?php

namespace App\Models;

use App\Models\Concerns\LimitedToCamps;
use Database\Factories\LandlordFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'landlord_type',
    'name',
    'contact_person_name',
    'email',
    'phone',
    'trade_license_number',
    'id_number',
    'tax_registration_number',
    'bank_name',
    'account_name',
    'iban',
    'address',
    'notes',
])]
class Landlord extends Model
{
    /** @use HasFactory<LandlordFactory> */
    use HasFactory, LimitedToCamps, SoftDeletes;

    public const TYPES = ['company', 'individual'];

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return HasMany<HeadLease, $this>
     */
    public function headLeases(): HasMany
    {
        return $this->hasMany(HeadLease::class);
    }

    /**
     * The properties leased from this landlord.
     *
     * @return HasMany<Property, $this>
     */
    public function properties(): HasMany
    {
        return $this->hasMany(Property::class);
    }

    /**
     * The camps' landlords, and those not yet letting anything.
     *
     * @param  Builder<static>  $query
     * @param  list<int>  $propertyIds
     */
    public function limitToCamps(Builder $query, array $propertyIds): void
    {
        $query->where(fn (Builder $landlords) => $landlords
            ->whereHas('properties')
            ->orWhereHas('headLeases')
            ->orWhere(fn (Builder $unplaced) => $unplaced
                ->whereDoesntHave('properties', fn (Builder $properties) => $properties->withoutGlobalScope('camps'))
                ->whereDoesntHave('headLeases', fn (Builder $leases) => $leases->withoutGlobalScope('camps'))));
    }

    /**
     * Landlords are reached through what they let.
     *
     * @param  list<int>  $propertyIds
     */
    public function isAtCamps(array $propertyIds): bool
    {
        return true;
    }
}
