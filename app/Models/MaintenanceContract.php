<?php

namespace App\Models;

use App\Models\Concerns\HasCheques;
use App\Models\Concerns\HasDocumentNumber;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\MaintenanceContractFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * An annual maintenance contract (AMC): a service company looking after one
 * kind of system at a property, such as its fire alarm, sprinklers and
 * extinguishers, for a term. It holds the contractor, the value and how it
 * is paid, how often the contractor visits and what they cover, and the
 * authority certificate the contract keeps valid (for fire safety, the
 * Civil Defence certificate).
 *
 * The contract value is paid to the contractor by a schedule of cheques,
 * one per payment under its terms (three a year when paid every four
 * months, four when paid quarterly). The contractor's own visit schedule
 * is kept as MaintenanceVisit rows, flagged on the dashboard from
 * `visit_alert_days` before each visit until it is done.
 *
 * Whether it is running, due for renewal or over is read from its dates
 * (see state()); only a cancellation is stored. The signed copy is kept on
 * the private disk and served only to the company's own users.
 */
#[Fillable([
    'vendor_name',
    'vendor_contact_person',
    'vendor_phone',
    'vendor_email',
    'vendor_licence_number',
    'reference_number',
    'start_date',
    'end_date',
    'contract_value',
    'payment_terms',
    'status',
    'visit_frequency',
    'last_visit_on',
    'response_time_hours',
    'visit_alert_days',
    'coverage',
    'certificate_number',
    'certificate_expires_on',
    'notes',
])]
class MaintenanceContract extends Model
{
    /** @use HasFactory<MaintenanceContractFactory> */
    use HasCheques, HasDocumentNumber, HasFactory, SoftDeletes;

    public const NUMBER_PREFIX = 'AMC';

    public const NUMBER_COLUMN = 'contract_number';

    /**
     * The kinds of contract, each with its own page under Contracts in the sidebar.
     */
    public const SERVICES = ['fire_safety', 'lifts', 'garbage', 'grease_traps', 'drainage', 'pest_control', 'air_conditioning', 'water_tanks'];

    /**
     * What each kind of contract can cover, as the form offers it. A system
     * named under more than one kind (such as spare parts) means the same in each.
     *
     * @var array<string, list<string>>
     */
    public const COVERAGE = [
        'fire_safety' => [
            'fire_alarm', 'extinguishers', 'hose_reels', 'sprinklers', 'fire_pumps', 'emergency_lighting',
            'exit_signs', 'gas_detection', 'kitchen_suppression', 'fire_blankets', 'fire_doors',
        ],
        'lifts' => [
            'passenger_lifts', 'goods_lifts', 'preventive_maintenance', 'breakdown_callouts', 'rescue_service',
            'spare_parts', 'lift_alarm', 'annual_inspection',
        ],
        'garbage' => ['general_waste', 'kitchen_waste', 'recyclables', 'bulky_waste', 'bins_supply', 'bin_washing', 'disposal_fees'],
        'grease_traps' => ['trap_cleaning', 'grease_removal', 'line_jetting', 'bio_dosing', 'disposal_records', 'inspection_reports'],
        'drainage' => ['septic_tanks', 'sewage_tanker', 'line_jetting', 'manholes', 'blockage_callouts', 'lifting_pumps', 'cctv_survey'],
        'pest_control' => ['crawling_insects', 'bed_bugs', 'rodents', 'flies_mosquitoes', 'termites', 'birds', 'fumigation', 'kitchen_areas'],
        'air_conditioning' => [
            'split_units', 'window_units', 'package_units', 'chillers', 'filter_cleaning', 'coil_cleaning',
            'gas_refill', 'duct_cleaning', 'spare_parts',
        ],
        'water_tanks' => ['roof_tanks', 'ground_tanks', 'tank_cleaning', 'disinfection', 'water_testing', 'water_pumps', 'water_filters'],
    ];

    /**
     * How a new contract of each kind starts out on the form: how often such
     * contractors usually come, and how they are usually paid.
     *
     * @var array<string, array{visit_frequency: string, payment_terms: string}>
     */
    public const DEFAULTS = [
        'fire_safety' => ['visit_frequency' => 'quarterly', 'payment_terms' => 'quarterly'],
        'lifts' => ['visit_frequency' => 'monthly', 'payment_terms' => 'quarterly'],
        'garbage' => ['visit_frequency' => 'daily', 'payment_terms' => 'monthly'],
        'grease_traps' => ['visit_frequency' => 'monthly', 'payment_terms' => 'monthly'],
        'drainage' => ['visit_frequency' => 'monthly', 'payment_terms' => 'per_visit'],
        'pest_control' => ['visit_frequency' => 'monthly', 'payment_terms' => 'quarterly'],
        'air_conditioning' => ['visit_frequency' => 'quarterly', 'payment_terms' => 'quarterly'],
        'water_tanks' => ['visit_frequency' => 'half_yearly', 'payment_terms' => 'per_visit'],
    ];

    /**
     * Stored statuses: a contract runs out on its end date by itself, so
     * only ending it early is recorded.
     */
    public const STATUSES = ['active', 'cancelled'];

    /**
     * Where a contract stands, from its dates and status.
     */
    public const STATES = ['upcoming', 'active', 'expiring', 'expired', 'cancelled'];

    /**
     * A running contract (or certificate) ending within this many days is due for renewal.
     */
    public const EXPIRING_DAYS = 60;

    public const PAYMENT_TERMS = ['upfront', 'half_yearly', 'four_monthly', 'quarterly', 'monthly', 'per_visit'];

    /**
     * How many months one payment covers under each of the terms paid by a
     * schedule of cheques; one paid upfront covers the whole term, and one
     * paid per visit is settled visit by visit instead.
     */
    public const PAYMENT_MONTHS = ['half_yearly' => 6, 'four_monthly' => 4, 'quarterly' => 3, 'monthly' => 1];

    /**
     * How many days before a visit the dashboard can start warning about it.
     */
    public const VISIT_ALERT_DAYS = [1, 2, 3, 5, 7];

    public const DEFAULT_VISIT_ALERT_DAYS = 5;

    /**
     * How often the contractor comes, as visits a year.
     */
    public const VISIT_FREQUENCIES = ['daily' => 365, 'weekly' => 52, 'fortnightly' => 26, 'monthly' => 12, 'quarterly' => 4, 'half_yearly' => 2, 'yearly' => 1];

    /**
     * The disk holding signed contracts.
     */
    public const DOCUMENT_DISK = 'local';

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
            'last_visit_on' => 'date',
            'certificate_expires_on' => 'date',
            'contract_value' => 'decimal:2',
            'response_time_hours' => 'integer',
            'visit_alert_days' => 'integer',
            'coverage' => 'array',
        ];
    }

    /**
     * Where the contract stands today: cancelled, not started yet, ended,
     * ending within EXPIRING_DAYS, or running.
     */
    public function state(): string
    {
        $today = today();

        return match (true) {
            $this->status === 'cancelled' => 'cancelled',
            $this->start_date->gt($today) => 'upcoming',
            $this->end_date->lt($today) => 'expired',
            $this->end_date->lte($today->copy()->addDays(self::EXPIRING_DAYS)) => 'expiring',
            default => 'active',
        };
    }

    /**
     * Whether the contractor is looking after the property today.
     */
    public function isRunning(): bool
    {
        return in_array($this->state(), ['active', 'expiring'], true);
    }

    /**
     * Contracts in one of `$states` (see state()).
     *
     * @param  Builder<MaintenanceContract>  $query
     * @param  list<string>|string  $states
     */
    #[Scope]
    protected function inState(Builder $query, array|string $states): void
    {
        $today = today();
        $renewBy = $today->copy()->addDays(self::EXPIRING_DAYS);

        $query->where(function (Builder $query) use ($states, $today, $renewBy) {
            foreach ((array) $states as $state) {
                $query->orWhere(fn (Builder $query) => match ($state) {
                    'cancelled' => $query->where('status', 'cancelled'),
                    'upcoming' => $query->where('status', 'active')->whereDate('start_date', '>', $today),
                    'expired' => $query->where('status', 'active')->whereDate('end_date', '<', $today),
                    'expiring' => $query->where('status', 'active')->whereDate('start_date', '<=', $today)->whereDate('end_date', '>=', $today)->whereDate('end_date', '<=', $renewBy),
                    'active' => $query->where('status', 'active')->whereDate('start_date', '<=', $today)->whereDate('end_date', '>', $renewBy),
                });
            }
        });
    }

    /**
     * The length of the term in whole months (a year from 1 Jan to 31 Dec is 12).
     */
    public function termMonths(): int
    {
        return max(1, (int) round($this->start_date->floatDiffInMonths($this->end_date->copy()->addDay())));
    }

    /**
     * How many visits the term holds at the agreed frequency.
     */
    public function visitCount(): int
    {
        return (int) max(1, ceil($this->termMonths() * self::VISIT_FREQUENCIES[$this->visit_frequency] / 12));
    }

    /**
     * How many payments the contract value is split into over the term.
     */
    public function paymentCount(): int
    {
        $months = $this->termMonths();

        return (int) match ($this->payment_terms) {
            'per_visit' => $this->visitCount(),
            'upfront' => 1,
            default => max(1, ceil($months / self::PAYMENT_MONTHS[$this->payment_terms])),
        };
    }

    /**
     * Each payment, as an equal share of the contract value.
     */
    public function installmentAmount(): float
    {
        return round((float) $this->contract_value / $this->paymentCount(), 2);
    }

    /**
     * When the contractor is next due. With the contractor's schedule on
     * file, the earliest visit still to happen (overdue ones included).
     * Without one, the agreed interval after the last recorded visit or,
     * with none recorded, the next date at that interval from the start.
     * None once the contract is over or cancelled, or when the next visit
     * would fall after its end.
     */
    public function nextVisitOn(): ?CarbonInterface
    {
        if (in_array($this->state(), ['expired', 'cancelled'], true)) {
            return null;
        }

        if ($this->visits->isNotEmpty()) {
            return $this->visits->filter(fn (MaintenanceVisit $visit) => $visit->isOpen())->min('scheduled_on');
        }

        if ($this->last_visit_on) {
            $next = $this->afterVisits($this->last_visit_on, 1);
        } else {
            $visits = 0;

            do {
                $next = $this->afterVisits($this->start_date, $visits++);
            } while ($next->lt(today()));
        }

        return $next->lte($this->end_date) ? $next : null;
    }

    /**
     * The date `$visits` visits after `$from` at the agreed frequency.
     */
    private function afterVisits(CarbonInterface $from, int $visits): CarbonInterface
    {
        return match ($this->visit_frequency) {
            'daily' => $from->copy()->addDays($visits),
            'weekly' => $from->copy()->addWeeks($visits),
            'fortnightly' => $from->copy()->addWeeks(2 * $visits),
            default => $from->copy()->addMonthsNoOverflow(intdiv(12, self::VISIT_FREQUENCIES[$this->visit_frequency]) * $visits),
        };
    }

    /**
     * Visit dates at the agreed frequency up to the end of the term, offered
     * as a first draft on the form that adds visits: carrying on from the
     * last visit on the schedule, or from the start date when there is
     * none. Empty for daily and weekly visits, which no one enters one by one.
     *
     * @return list<string>
     */
    public function suggestedVisitDates(): array
    {
        if (in_array($this->visit_frequency, ['daily', 'weekly'], true)) {
            return [];
        }

        $latest = $this->visits->where('status', '!=', 'cancelled')->max('scheduled_on');
        [$from, $first] = $latest ? [$latest, 1] : [$this->start_date, 0];
        $dates = [];

        for ($visit = $first; $visit < $first + 60; $visit++) {
            $date = $this->afterVisits($from, $visit);

            if ($date->gt($this->end_date)) {
                break;
            }

            $dates[] = $date->toDateString();
        }

        return $dates;
    }

    /**
     * Record the latest visit done as the contract's last visit, which a
     * contract without a schedule counts its next visit from.
     */
    public function syncLastVisit(): void
    {
        $latest = $this->visits()->where('status', 'done')->max('completed_on');

        if ($latest !== null) {
            $this->forceFill(['last_visit_on' => $latest])->save();
        }

        $this->unsetRelation('visits');
    }

    /**
     * Cheques go to the contractor.
     */
    public function chequeDirection(): string
    {
        return 'issued';
    }

    /**
     * How many months one payment covers: the whole term when paid upfront.
     */
    public function monthsPerCheque(): int
    {
        return self::PAYMENT_MONTHS[$this->payment_terms] ?? $this->termMonths();
    }

    /**
     * Each cheque is an equal share of the contract value; plannedCheques()
     * gives the last one what rounding leaves over.
     */
    public function plannedChequeAmount(CarbonImmutable $from, CarbonImmutable $to): float
    {
        return $this->installmentAmount();
    }

    /**
     * One cheque per payment the terms call for (see paymentCount()), each
     * dated on the first day it pays for, a fixed number of months from the
     * start. Together they come to the contract value. A contract paid per
     * visit has none: each visit is paid as it is done.
     *
     * @return list<array{purpose: string, sequence: int, period_start: ?string, period_end: ?string, cheque_date: string, amount: float}>
     */
    public function plannedCheques(): array
    {
        if ($this->payment_terms === 'per_visit' || (float) $this->contract_value <= 0) {
            return [];
        }

        $count = $this->paymentCount();
        $months = $this->monthsPerCheque();
        $start = $this->start_date->toImmutable()->startOfDay();
        $end = $this->end_date->toImmutable()->startOfDay();
        $each = $this->installmentAmount();
        $plan = [];

        for ($index = 0; $index < $count; $index++) {
            $from = $start->addMonthsNoOverflow($months * $index);
            $to = $index === $count - 1 ? $end : $start->addMonthsNoOverflow($months * ($index + 1))->subDay();

            $plan[] = [
                'purpose' => 'rent',
                'sequence' => $index + 1,
                'period_start' => $from->toDateString(),
                'period_end' => ($to->gt($end) ? $end : $to)->toDateString(),
                'cheque_date' => $from->toDateString(),
                'amount' => $index === $count - 1 ? round((float) $this->contract_value - $each * ($count - 1), 2) : $each,
            ];
        }

        return $plan;
    }

    /**
     * Whether the certificate is valid, due for renewal or expired; null
     * when no expiry date is on file.
     */
    public function certificateState(): ?string
    {
        $expiresOn = $this->certificate_expires_on;

        return match (true) {
            $expiresOn === null => null,
            $expiresOn->lt(today()) => 'expired',
            $expiresOn->lte(today()->addDays(self::EXPIRING_DAYS)) => 'expiring',
            default => 'valid',
        };
    }

    /**
     * Save the signed contract, replacing any earlier copy.
     */
    public function storeDocument(UploadedFile $file): void
    {
        $this->removeDocument();

        $path = $file->storeAs(
            "amcs/{$this->company_id}/{$this->id}",
            'contract-'.Str::random(12).'.'.($file->extension() ?: 'pdf'),
            self::DOCUMENT_DISK,
        );

        $this->forceFill(['document_path' => $path, 'document_name' => Str::limit($file->getClientOriginalName(), 250, '')])->save();
    }

    public function removeDocument(): void
    {
        if ($this->document_path) {
            Storage::disk(self::DOCUMENT_DISK)->delete($this->document_path);
            $this->forceFill(['document_path' => null, 'document_name' => null])->save();
        }
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
     * The contractor's visit schedule.
     *
     * @return HasMany<MaintenanceVisit, $this>
     */
    public function visits(): HasMany
    {
        return $this->hasMany(MaintenanceVisit::class);
    }

    /**
     * The contract this one renewed.
     *
     * @return BelongsTo<MaintenanceContract, $this>
     */
    public function renewedFrom(): BelongsTo
    {
        return $this->belongsTo(MaintenanceContract::class, 'renewed_from_id');
    }

    /**
     * The contract that renewed this one.
     *
     * @return HasOne<MaintenanceContract, $this>
     */
    public function renewal(): HasOne
    {
        return $this->hasOne(MaintenanceContract::class, 'renewed_from_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
