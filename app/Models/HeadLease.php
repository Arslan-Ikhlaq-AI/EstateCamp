<?php

namespace App\Models;

use App\Models\Concerns\HasDocumentNumber;
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
 * schedule of HeadLeasePayment instalments.
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
    use HasDocumentNumber, HasFactory, SoftDeletes;

    public const NUMBER_PREFIX = 'HL';

    public const NUMBER_COLUMN = 'lease_number';

    public const STATUSES = ['draft', 'active', 'expired', 'terminated'];

    /**
     * How many instalments a year the rent can be split into; each divides twelve months evenly.
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
     * The instalments the lease's terms produce: one every 12 / payments_per_year
     * months from the start date for as long as the lease runs, each an equal
     * share of the annual rent.
     *
     * @return list<array{installment_number: int, due_date: string, amount: float}>
     */
    public function plannedInstallments(): array
    {
        $monthsApart = intdiv(12, $this->payments_per_year);
        $amount = round((float) $this->annual_rent / $this->payments_per_year, 2);
        $start = $this->start_date->toImmutable();
        $installments = [];

        for ($number = 1; ($due = $start->addMonthsNoOverflow($monthsApart * ($number - 1)))->lte($this->end_date); $number++) {
            $installments[] = ['installment_number' => $number, 'due_date' => $due->toDateString(), 'amount' => $amount];
        }

        return $installments;
    }

    /**
     * Replace the payment schedule with the one the current terms produce.
     * Refused once any instalment is no longer just scheduled, because a paid
     * or bounced instalment records a real cheque.
     */
    public function rebuildSchedule(): bool
    {
        if ($this->payments()->whereNot('status', 'scheduled')->exists()) {
            return false;
        }

        $this->payments()->delete();

        foreach ($this->plannedInstallments() as $installment) {
            $this->payments()->forceCreate([...$installment, 'company_id' => $this->company_id]);
        }

        return true;
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
            'landlord_name' => $this->landlord->name,
            'landlord_phone' => $this->landlord->phone,
            'lease_start_date' => $this->start_date,
            'lease_end_date' => $this->end_date,
        ]);
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
     * @return HasMany<HeadLeasePayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(HeadLeasePayment::class);
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
