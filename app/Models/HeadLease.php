<?php

namespace App\Models;

use App\Models\Concerns\HasCheques;
use App\Models\Concerns\HasDocumentNumber;
use Carbon\CarbonImmutable;
use Database\Factories\HeadLeaseFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * The operator renting a property from a landlord. Its terms produce a
 * schedule of cheques issued to the landlord: one per instalment, plus one
 * for the security deposit.
 */
#[Fillable([
    'ejari_number',
    'start_date',
    'end_date',
    'annual_rent',
    'payments_per_year',
    'security_deposit',
    'notice_period_days',
    'status',
    'notes',
])]
class HeadLease extends Model
{
    /** @use HasFactory<HeadLeaseFactory> */
    use HasCheques, HasDocumentNumber, HasFactory, SoftDeletes;

    public const NUMBER_PREFIX = 'HL';

    public const NUMBER_COLUMN = 'lease_number';

    public const STATUSES = ['draft', 'active', 'expired', 'terminated'];

    /**
     * How many cheques a year the rent can be split into; each divides twelve months evenly.
     */
    public const PAYMENTS_PER_YEAR = [1, 2, 3, 4, 6, 12];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'annual_rent' => 'decimal:2',
            'payments_per_year' => 'integer',
            'security_deposit' => 'decimal:2',
            'notice_period_days' => 'integer',
        ];
    }

    /**
     * Rent cheques go to the landlord.
     */
    public function chequeDirection(): string
    {
        return 'issued';
    }

    public function monthsPerCheque(): int
    {
        return intdiv(12, $this->payments_per_year);
    }

    /**
     * Each rent cheque is an equal share of the annual rent.
     */
    public function plannedChequeAmount(CarbonImmutable $from, CarbonImmutable $to): float
    {
        return round((float) $this->annual_rent / $this->payments_per_year, 2);
    }

    /**
     * Instalments fall a fixed number of months from the start date.
     */
    protected function chainsChequePeriods(): bool
    {
        return false;
    }

    /**
     * Copy an active lease's landlord and dates onto its property, which the
     * property pages and lease-expiry notifications read.
     */
    public function syncPropertyLease(): void
    {
        if ($this->status !== 'active') {
            return;
        }

        $this->property->update([
            'ownership_type' => 'leased',
            'landlord_id' => $this->landlord_id,
            'lease_start_date' => $this->start_date,
            'lease_end_date' => $this->end_date,
        ]);
    }

    /**
     * @return HasMany<PropertyDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(PropertyDocument::class);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return BelongsTo<Landlord, $this>
     */
    public function landlord(): BelongsTo
    {
        return $this->belongsTo(Landlord::class);
    }

    /**
     * @return BelongsTo<HeadLease, $this>
     */
    public function renewedFrom(): BelongsTo
    {
        return $this->belongsTo(HeadLease::class, 'renewed_from_id');
    }

    /**
     * @return HasOne<HeadLease, $this>
     */
    public function renewal(): HasOne
    {
        return $this->hasOne(HeadLease::class, 'renewed_from_id');
    }
}
