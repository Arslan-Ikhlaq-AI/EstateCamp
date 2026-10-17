<?php

namespace App\Models;

use Database\Factories\LandlordFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
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
    use HasFactory, SoftDeletes;

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
}
