<?php

namespace App\Models;

use Database\Factories\ClientFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * Whoever pays the operator: a company housing its workers, or an
 * individual. The people who actually stay are Occupants.
 */
#[Fillable([
    'client_type',
    'name',
    'contact_person_name',
    'email',
    'phone',
    'trade_license_number',
    'tax_registration_number',
    'id_type',
    'id_number',
    'nationality',
    'address',
    'status',
    'notes',
])]
class Client extends Model
{
    /** @use HasFactory<ClientFactory> */
    use HasFactory, SoftDeletes;

    public const TYPES = ['company', 'individual'];

    public const STATUSES = ['active', 'inactive'];

    public const ID_TYPES = ['emirates_id', 'passport'];

    /**
     * What the client still owes across all invoices that are not void.
     */
    public function outstandingBalance(): float
    {
        return round((float) $this->invoices()->whereNot('status', 'void')->sum(DB::raw('total - amount_paid')), 2);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return HasMany<Contract, $this>
     */
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    /**
     * @return HasMany<Occupant, $this>
     */
    public function occupants(): HasMany
    {
        return $this->hasMany(Occupant::class);
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /**
     * Beds or rooms the client rents without a contract.
     *
     * @return HasMany<RoomRental, $this>
     */
    public function roomRentals(): HasMany
    {
        return $this->hasMany(RoomRental::class);
    }
}
