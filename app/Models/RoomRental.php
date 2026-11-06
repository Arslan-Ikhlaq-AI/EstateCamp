<?php

namespace App\Models;

use App\Models\Concerns\HasBillingStatement;
use App\Models\Concerns\HasDocumentNumber;
use App\Models\Concerns\HasExtraPayments;
use App\Models\Concerns\LimitedToCamps;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\RoomRentalFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * A short-term rental: a company or a person taking one or more whole rooms
 * of a property, straight from the company without a contract.
 * It has a start date and a monthly rent but no term: it runs, and goes on
 * being charged month after month, until it is ended. Nobody is checked in
 * and nothing is invoiced.
 *
 * Rent falls due monthly from the start date, a month in advance: each
 * month that has begun is owed, and a month cut short by moving out is
 * charged for its days. Payments are receipts (RentalPayments) for rent or
 * another charge; a cheque from the tenant waits in the cheque register and
 * becomes a receipt when it clears. Paying more than is owed is credit that
 * comes off the next months. Rent still owed GRACE_DAYS after its month
 * began is overdue. The commission and security deposit are extra payments,
 * kept apart from the rent and its receipts.
 *
 * The end_date column is left from when rentals had a term and is not read.
 */
#[Fillable([
    'monthly_rent',
    'security_deposit',
    'start_date',
    'notes',
])]
class RoomRental extends Model
{
    /** @use HasFactory<RoomRentalFactory> */
    use HasBillingStatement, HasDocumentNumber, HasExtraPayments, HasFactory, LimitedToCamps;

    public const NUMBER_PREFIX = 'RNT';

    public const NUMBER_COLUMN = 'rental_number';

    public const STATUSES = ['active', 'ended'];

    /**
     * How the rent stands today: nothing owed, owed but within the grace
     * days, or overdue.
     */
    public const STANDINGS = ['paid_up', 'due', 'overdue'];

    public const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'cheque'];

    public const REFUND_METHODS = ['cash', 'bank_transfer', 'cheque'];

    /**
     * How the first month can be paid on the rental form. A transfer or cash
     * is a receipt straight away; a cheque goes to the cheque register, in hand.
     */
    public const FIRST_PAYMENT_METHODS = ['bank_transfer', 'cash', 'cheque'];

    /**
     * Days after a month's rent falls due before it counts as overdue.
     */
    public const GRACE_DAYS = 5;

    /**
     * How far ahead the schedule is followed to work out what advance
     * payments cover on a rental still running.
     */
    private const OPEN_ENDED_HORIZON_YEARS = 3;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'moved_out_on' => 'date',
            'monthly_rent' => 'decimal:2',
            'security_deposit' => 'decimal:2',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * A rental runs until it is ended, so it has no total rent: a commission
     * percentage is taken of the monthly rent.
     */
    public function commissionBase(): float
    {
        return round((float) $this->monthly_rent, 2);
    }

    public function extraPaymentPropertyId(): ?int
    {
        return $this->property_id;
    }

    /**
     * The last night the tenant is charged for: the day before they moved
     * out. Null while the rental runs, as it goes on until it is ended.
     */
    public function lastDay(): ?CarbonImmutable
    {
        return $this->moved_out_on?->toImmutable()->subDay();
    }

    /**
     * The monthly rent periods from the start date, each with what it
     * costs, that begin on or before `$through`. A month cut short by
     * moving out is charged for its share of days.
     *
     * @return list<array{start: CarbonImmutable, end: CarbonImmutable, amount: float}>
     */
    public function rentPeriods(CarbonInterface $through): array
    {
        $through = CarbonImmutable::parse($through)->startOfDay();
        $lastDay = $this->lastDay();
        $until = $lastDay === null || $lastDay->gt($through) ? $through->addMonthsNoOverflow(1) : $lastDay;

        if ($lastDay !== null && $until->gt($lastDay)) {
            $until = $lastDay;
        }

        $rent = (float) $this->monthly_rent;
        $periods = [];

        foreach (Cheque::periods($this->start_date, $until, 1) as [$from, $to]) {
            if ($from->gt($through)) {
                break;
            }

            $fullEnd = $from->addMonthsNoOverflow(1)->subDay();
            $amount = $to->equalTo($fullEnd) ? $rent : round($rent * ($from->diffInDays($to) + 1) / ($from->diffInDays($fullEnd) + 1), 2);

            $periods[] = ['start' => $from, 'end' => $to, 'amount' => $amount];
        }

        return $periods;
    }

    /**
     * Rent owed for every month begun by `$on` (today by default).
     */
    public function rentDue(?CarbonInterface $on = null): float
    {
        return round(array_sum(array_column($this->rentPeriods($on ?? today()), 'amount')), 2);
    }

    /**
     * What has been paid for `$purpose` (rent or other), leaving out voided
     * receipts. Uses a loaded `{purpose}_paid` sum when present.
     */
    public function paidFor(string $purpose): float
    {
        $loaded = $this->getAttribute("{$purpose}_paid");

        if ($loaded !== null) {
            return round((float) $loaded, 2);
        }

        return round((float) $this->payments()->where('status', 'cleared')->where('purpose', $purpose)->sum('amount'), 2);
    }

    /**
     * The months of rent fallen due by `$on` (today by default) and not yet
     * paid, oldest first, each with the day it fell due and what is left of
     * it. Payments settle the oldest months first, so together they come to
     * the arrears.
     *
     * @return list<array{dueOn: CarbonImmutable, amount: float}>
     */
    public function unpaidRent(?CarbonInterface $on = null): array
    {
        $remaining = $this->paidFor('rent');
        $unpaid = [];

        foreach ($this->rentPeriods($on ?? today()) as $period) {
            $settled = min($remaining, $period['amount']);
            $remaining = round($remaining - $settled, 2);
            $owed = round($period['amount'] - $settled, 2);

            if ($owed > 0) {
                $unpaid[] = ['dueOn' => $period['start'], 'amount' => $owed];
            }
        }

        return $unpaid;
    }

    /**
     * The months of rent that matter from `$from` to `$to`, oldest first:
     * those from before still unpaid, those in the period, those after it
     * already paid for, and the next one to pay. Payments settle the oldest
     * months first. `credit` is the part of a month paid before it began,
     * and a month paid wholly that way reads as `credit`: nothing was left
     * to charge when it came.
     *
     * @return list<array{start: string, end: string, amount: float, paid: float, credit: float, left: float, status: string}>
     */
    public function rentMonths(CarbonInterface $from, CarbonInterface $to): array
    {
        $from = CarbonImmutable::parse($from)->startOfDay();
        $to = CarbonImmutable::parse($to)->startOfDay();
        $receipts = $this->billingPayments();
        $months = [];

        foreach ($this->rentPeriods($this->lastDay() ?? $to->addYears(self::OPEN_ENDED_HORIZON_YEARS)) as $period) {
            $paid = 0.0;
            $credit = 0.0;

            while ($receipts !== [] && $paid < $period['amount'] - 0.005) {
                $taken = round(min($receipts[0]['amount'], $period['amount'] - $paid), 2);
                $paid = round($paid + $taken, 2);
                $credit = round($credit + ($receipts[0]['paidOn']->lt($period['start']) ? $taken : 0), 2);
                $receipts[0]['amount'] = round($receipts[0]['amount'] - $taken, 2);

                if ($receipts[0]['amount'] <= 0) {
                    array_shift($receipts);
                }
            }

            $left = round($period['amount'] - $paid, 2);
            $isUpcoming = $period['start']->gt($to);

            if ($left > 0 || $period['end']->gte($from)) {
                $months[] = [
                    'start' => $period['start']->toDateString(),
                    'end' => $period['end']->toDateString(),
                    'amount' => $period['amount'],
                    'paid' => $paid,
                    'credit' => $credit,
                    'left' => $left,
                    'status' => match (true) {
                        $left <= 0 => $credit >= $period['amount'] ? 'credit' : 'paid',
                        $isUpcoming => 'upcoming',
                        $paid > 0 => 'partial',
                        default => 'unpaid',
                    },
                ];
            }

            if ($isUpcoming && $left > 0) {
                break;
            }
        }

        return $months;
    }

    /**
     * Where the rent stands on `$on` (today by default): what has fallen
     * due and been paid, the balance (negative when paid in advance), the
     * last day the payments cover, the next day rent falls due and how
     * much of it is still to pay, and whether it is paid up, due or overdue.
     *
     * @return array{due: float, paid: float, balance: float, arrears: float, paidThrough: ?CarbonImmutable, nextDue: ?CarbonImmutable, nextDueAmount: float, standing: string, overdueDays: int}
     */
    public function rentStanding(?CarbonInterface $on = null): array
    {
        $on = CarbonImmutable::parse($on ?? today())->startOfDay();
        $due = $this->rentDue($on);
        $paid = $this->paidFor('rent');
        $remaining = $paid;
        $paidThrough = null;
        $nextDue = null;
        $nextDueAmount = 0.0;

        foreach ($this->rentPeriods($this->lastDay() ?? $on->addYears(self::OPEN_ENDED_HORIZON_YEARS)) as $period) {
            if ($remaining + 0.005 >= $period['amount']) {
                $remaining = round($remaining - $period['amount'], 2);
                $paidThrough = $period['end'];

                continue;
            }

            $nextDue = $period['start'];
            $nextDueAmount = round($period['amount'] - $remaining, 2);

            break;
        }

        $arrears = round(max(0, $due - $paid), 2);
        $overdueDays = $arrears > 0 && $nextDue ? max(0, (int) $nextDue->diffInDays($on, false)) : 0;

        return [
            'due' => $due,
            'paid' => $paid,
            'balance' => round($due - $paid, 2),
            'arrears' => $arrears,
            'paidThrough' => $paidThrough,
            'nextDue' => $nextDue,
            'nextDueAmount' => $nextDueAmount,
            'standing' => match (true) {
                $arrears <= 0 => 'paid_up',
                $overdueDays > self::GRACE_DAYS => 'overdue',
                default => 'due',
            },
            'overdueDays' => $overdueDays,
        ];
    }

    /**
     * The deposit agreed, paid, still to collect, handed back and still held.
     *
     * @return array{agreed: float, paid: float, toCollect: float, refunded: float, held: float}
     */
    public function depositStanding(): array
    {
        $deposit = $this->deposit()->first();

        return [
            'agreed' => round((float) $this->security_deposit, 2),
            'paid' => $deposit?->status === 'received' ? (float) $deposit->amount : 0.0,
            'toCollect' => $deposit?->status === 'pending' ? (float) $deposit->amount : 0.0,
            'refunded' => (float) $deposit?->settled_amount,
            'held' => (float) $deposit?->remaining(),
        ];
    }

    /**
     * The months a rent payment of `$amount` pays for, after what has
     * already been paid: from the first month not yet fully paid to the
     * last month the payment reaches. Null when there is no month left to pay.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public function coverageFor(float $amount): ?array
    {
        $before = $this->paidFor('rent');
        $after = $before + $amount;
        $from = null;
        $to = null;
        $running = 0.0;

        foreach ($this->rentPeriods($this->lastDay() ?? today()->addYears(self::OPEN_ENDED_HORIZON_YEARS)) as $period) {
            $periodStart = $running;
            $running = round($running + $period['amount'], 2);

            if ($running <= $before + 0.005) {
                continue;
            }

            $from ??= $period['start'];

            if ($periodStart < $after - 0.005) {
                $to = $period['end'];
            }

            if ($running >= $after - 0.005) {
                break;
            }
        }

        return $from && $to ? [$from, $to] : null;
    }

    /**
     * The company's bill: the rent of each month begun by `$through`,
     * falling due on its first day, for all the rental's rooms together.
     * The deposit is collected on its own.
     *
     * @return list<array{key: string, type: string, id: ?int, number: ?string, start: CarbonImmutable, end: CarbonImmutable, chargedOn: CarbonImmutable, amount: float, isPlanned: bool}>
     */
    public function billingCharges(CarbonInterface $through): array
    {
        return array_map(fn (array $period) => [
            'key' => 'rent-'.$period['start']->toDateString(),
            'type' => 'rent',
            'id' => null,
            'number' => null,
            'start' => $period['start'],
            'end' => $period['end'],
            'chargedOn' => $period['start'],
            'amount' => $period['amount'],
            'isPlanned' => false,
        ], $this->rentPeriods($through));
    }

    /**
     * The rent receipts not voided. Uses loaded `payments` when present.
     *
     * @return list<array{key: string, id: int, number: string, paidOn: CarbonImmutable, method: string, amount: float}>
     */
    public function billingPayments(): array
    {
        return ($this->relationLoaded('payments') ? $this->payments : $this->payments()->get())
            ->filter(fn (RentalPayment $payment) => $payment->status === 'cleared' && $payment->purpose === 'rent')
            ->sortBy([['paid_on', 'asc'], ['id', 'asc']])
            ->map(fn (RentalPayment $payment) => [
                'key' => "receipt-{$payment->id}",
                'id' => $payment->id,
                'number' => $payment->receipt_number,
                'paidOn' => $payment->paid_on->toImmutable(),
                'method' => $payment->method,
                'amount' => (float) $payment->amount,
            ])
            ->values()
            ->all();
    }

    /**
     * Bills run to the last night the company is charged for; a rental
     * still running has no last day.
     */
    protected function lastBillingDay(): ?CarbonInterface
    {
        return $this->lastDay();
    }

    /**
     * A rent receipt dated today. Paying more than is due pays the coming
     * months ahead.
     */
    protected function recordCollection(float $amount, CarbonInterface $through, string $method, ?User $by): RentalPayment
    {
        $this->unsetRelation('payments');

        return $this->recordPayment(['paid_on' => today(), 'amount' => $amount, 'purpose' => 'rent', 'method' => $method], $by);
    }

    /**
     * Record money paid in cash, by card or transfer as a receipt. Rent
     * receipts note the months they pay for.
     *
     * @param  array{paid_on: mixed, amount: mixed, purpose: string, method: string, reference?: ?string, notes?: ?string}  $details
     */
    public function recordPayment(array $details, ?User $by = null, ?Cheque $cheque = null): RentalPayment
    {
        return DB::transaction(function () use ($details, $by, $cheque) {
            $paidOn = CarbonImmutable::parse($details['paid_on']);
            $coverage = $details['purpose'] === 'rent' ? $this->coverageFor((float) $details['amount']) : null;

            $payment = new RentalPayment([
                'paid_on' => $paidOn,
                'amount' => $details['amount'],
                'purpose' => $details['purpose'],
                'method' => $details['method'],
                'reference' => filled($details['reference'] ?? null) ? trim($details['reference']) : null,
                'notes' => filled($details['notes'] ?? null) ? trim($details['notes']) : null,
            ]);
            $payment->forceFill([
                'company_id' => $this->company_id,
                'room_rental_id' => $this->id,
                'receipt_number' => RentalPayment::nextNumber($this->company_id, $paidOn),
                'period_start' => $coverage[0] ?? null,
                'period_end' => $coverage[1] ?? null,
                'cheque_id' => $cheque?->id,
                'status' => 'cleared',
                'received_by' => $by?->id,
            ])->save();

            return $payment;
        });
    }

    /**
     * Take a cheque from the tenant into the cheque register, in hand. It
     * counts towards the rent only once it clears.
     *
     * @param  array{cheque_date: mixed, amount: mixed, cheque_number: string, bank_name: string, account_holder?: ?string, front_image?: ?UploadedFile, back_image?: ?UploadedFile, notes?: ?string}  $entry
     */
    public function receiveCheque(array $entry, ?User $by = null): Cheque
    {
        return DB::transaction(function () use ($entry, $by) {
            $cheque = new Cheque;
            $cheque->forceFill([
                'company_id' => $this->company_id,
                'direction' => 'received',
                'chequeable_type' => $this->getMorphClass(),
                'chequeable_id' => $this->id,
                'purpose' => 'rent',
                'sequence' => (int) $this->cheques()->where('purpose', 'rent')->max('sequence') + 1,
                'status' => 'pending',
                'notes' => filled($entry['notes'] ?? null) ? trim($entry['notes']) : null,
            ]);
            $cheque->applyEntry([
                'cheque_date' => $entry['cheque_date'],
                'amount' => $entry['amount'],
                'cheque_number' => $entry['cheque_number'],
                'bank_name' => $entry['bank_name'],
                'account_holder' => $entry['account_holder'] ?? null,
                'front_image' => $entry['front_image'] ?? null,
                'back_image' => $entry['back_image'] ?? null,
            ], $by);

            return $cheque;
        });
    }

    /**
     * Turn a cleared cheque from the tenant into a receipt on the day it cleared.
     */
    public function settleCheque(Cheque $cheque, CarbonInterface $on): RentalPayment
    {
        return $this->recordPayment([
            'paid_on' => $on,
            'amount' => $cheque->amount,
            'purpose' => 'rent',
            'method' => 'cheque',
            'reference' => "Cheque {$cheque->cheque_number}",
        ], cheque: $cheque);
    }

    /**
     * The tenant moves out on `$on`: the rental ends (rent stops the night
     * before) and any deposit handed back settles the deposit. Anyone still
     * staying under an older rental is checked out.
     *
     * @throws ValidationException When the rental has already ended or the refund is more than the deposit held.
     */
    public function end(CarbonInterface $on, ?float $refund = null, ?string $refundMethod = null, ?string $note = null, ?User $by = null): void
    {
        if (! $this->isActive()) {
            throw ValidationException::withMessages(['moved_out_on' => 'This rental has already ended.']);
        }

        $held = $this->depositStanding()['held'];

        if ($refund !== null && $refund > $held + 0.005) {
            throw ValidationException::withMessages(['deposit_refunded' => "Only {$held} of the deposit is held, so no more can be handed back."]);
        }

        DB::transaction(function () use ($on, $refund, $refundMethod, $note, $by) {
            $this->occupancies()->whereNull('check_out_date')->with('room')->get()->each(function (Occupancy $stay) use ($on) {
                $earliest = $stay->check_in_date->copy()->addDay();
                $stay->update(['check_out_date' => $on->lt($earliest) ? $earliest : $on]);
                $stay->room?->recalculateOccupancy();
            });

            $this->forceFill([
                'status' => 'ended',
                'moved_out_on' => $on,
                'notes' => filled($note) ? trim(implode("\n", array_filter([$this->notes, trim($note)]))) : $this->notes,
            ])->save();
            $this->recountRooms();

            if ($refund > 0) {
                $this->deposit()->first()->settle([
                    'settled_on' => $on,
                    'amount' => round($refund, 2),
                    'method' => $refundMethod ?? 'cash',
                    'paid_to' => $this->client->name,
                    'notes' => 'Handed back when moving out.',
                ], $by);
            }
        });
    }

    /**
     * Recount whether the rental's rooms are occupied: it holds them from
     * its start date while it runs, whether or not anyone checks in.
     */
    public function recountRooms(): void
    {
        $this->rooms()->get()->each->recalculateOccupancy();
    }

    /**
     * Rooms a short-term rental of the company holds: one running or yet to
     * start, until it is ended.
     *
     * @return list<int>
     */
    public static function heldRoomIds(int $companyId, ?int $exceptRentalId = null): array
    {
        return DB::table('room_rental_rooms')
            ->whereIn('room_rental_id', self::query()
                ->where('company_id', $companyId)
                ->active()
                ->when($exceptRentalId, fn (Builder $query) => $query->whereKeyNot($exceptRentalId))
                ->select('id'))
            ->pluck('room_id')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Rooms a short-term rental cannot take: those a running or draft
     * contract rents, and those another running rental holds.
     *
     * @return list<int>
     */
    public static function unavailableRoomIds(int $companyId, ?int $exceptRentalId = null): array
    {
        $underContract = ContractLine::query()
            ->where('company_id', $companyId)
            ->whereNotNull('room_id')
            ->whereDate('end_date', '>=', today())
            ->whereHas('contract', fn (Builder $contracts) => $contracts->whereIn('status', ['draft', 'active']))
            ->pluck('room_id');

        return $underContract->concat(self::heldRoomIds($companyId, $exceptRentalId))->unique()->values()->all();
    }

    /**
     * Active rooms of the company a short-term rental could take whole: not
     * held by a contract or another rental, with nobody staying in them,
     * ordered by property and room number.
     *
     * @return Collection<int, Room>
     */
    public static function roomsToRent(Company $company): Collection
    {
        return $company->rooms()
            ->where('status', 'active')
            ->whereKeyNot(self::unavailableRoomIds($company->id))
            ->whereDoesntHave('occupancies', fn (Builder $stays) => $stays->whereNull('check_out_date'))
            ->with('property:id,name,code')
            ->get()
            ->sortBy(fn (Room $room) => [$room->property->name, $room->room_number])
            ->values();
    }

    /**
     * @param  Builder<RoomRental>  $query
     */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('room_rentals.status', 'active');
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * The company or person that rents and pays.
     *
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * The whole rooms the rental holds, all in its property.
     *
     * @return BelongsToMany<Room, $this>
     */
    public function rooms(): BelongsToMany
    {
        return $this->belongsToMany(Room::class, 'room_rental_rooms');
    }

    /**
     * People checked into the rooms under an older rental.
     *
     * @return HasMany<Occupancy, $this>
     */
    public function occupancies(): HasMany
    {
        return $this->hasMany(Occupancy::class);
    }

    /**
     * Every receipt, voided ones included.
     *
     * @return HasMany<RentalPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(RentalPayment::class);
    }

    /**
     * Cheques the tenant has handed over.
     *
     * @return MorphMany<Cheque, $this>
     */
    public function cheques(): MorphMany
    {
        return $this->morphMany(Cheque::class, 'chequeable');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
