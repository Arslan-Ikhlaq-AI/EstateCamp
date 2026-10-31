<?php

namespace App\Models;

use Database\Factories\OccupantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A person who stays in a room. `client` is who pays for them: their
 * employer, or the occupant themselves when the client is an individual.
 */
#[Fillable([
    'client_id',
    'full_name',
    'gender',
    'nationality',
    'id_type',
    'id_number',
    'phone',
    'employee_number',
    'notes',
])]
class Occupant extends Model
{
    /** @use HasFactory<OccupantFactory> */
    use HasFactory, SoftDeletes;

    public const GENDERS = ['male', 'female'];

    public const ID_TYPES = ['emirates_id', 'passport'];

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return HasMany<Occupancy, $this>
     */
    public function occupancies(): HasMany
    {
        return $this->hasMany(Occupancy::class);
    }

    /**
     * The stay in progress, if the occupant is checked in.
     *
     * @return HasOne<Occupancy, $this>
     */
    public function currentStay(): HasOne
    {
        return $this->hasOne(Occupancy::class)->whereNull('check_out_date');
    }
}
