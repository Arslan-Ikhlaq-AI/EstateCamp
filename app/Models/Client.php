<?php

namespace App\Models;

use App\Models\Concerns\LimitedToCamps;
use Database\Factories\ClientFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
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
    use HasFactory, LimitedToCamps, SoftDeletes;

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
     * Rooms the client rents short-term, without a contract.
     *
     * @return HasMany<RoomRental, $this>
     */
    public function roomRentals(): HasMany
    {
        return $this->hasMany(RoomRental::class);
    }

    /**
     * Clients renting at the camps, and those not renting anywhere yet, so a new one can be chosen.
     *
     * @param  Builder<static>  $query
     * @param  list<int>  $propertyIds
     */
    public function limitToCamps(Builder $query, array $propertyIds): void
    {
        $query->where(fn (Builder $clients) => $clients
            ->whereHas('contracts')
            ->orWhereHas('roomRentals')
            ->orWhere(fn (Builder $unplaced) => $unplaced
                ->whereDoesntHave('contracts', fn (Builder $contracts) => $contracts->withoutGlobalScope('camps'))
                ->whereDoesntHave('roomRentals', fn (Builder $rentals) => $rentals->withoutGlobalScope('camps'))));
    }

    /**
     * Clients are reached through what they rent.
     *
     * @param  list<int>  $propertyIds
     */
    public function isAtCamps(array $propertyIds): bool
    {
        return true;
    }
}
