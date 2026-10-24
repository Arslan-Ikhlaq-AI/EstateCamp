<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\ChequeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * One cheque, the main record of money moving under an agreement: received
 * from a client under a Contract or from an individual under a RoomRental,
 * or issued to a landlord under a HeadLease (vendors' service contracts
 * will issue them too).
 *
 * A received cheque goes pending (expected, not collected yet) → received
 * (in hand) → deposited → cleared, or bounces. Clearing it records a client
 * Payment and settles the contract's invoices, or gives the tenant of a
 * room rental their receipt. An issued cheque goes pending
 * (not written yet) → issued (handed over) → cleared, or bounces. A bounced
 * cheque is replaced by a new one for the same period.
 *
 * Those stages are the cheque's `status`. What people see is one of the
 * company's named ChequeStatus entries for that stage (such as Submitted
 * or Approved), and moveTo() moves a cheque between them, noting each move
 * in its history.
 *
 * Photos of the cheque are kept on the private disk, because they show bank
 * account details; they are served only to the company's own users.
 */
#[Fillable([
    'cheque_date',
    'amount',
    'cheque_number',
    'bank_name',
    'account_holder',
    'notes',
])]
class Cheque extends Model
{
    /** @use HasFactory<ChequeFactory> */
    use HasFactory;

    public const DIRECTIONS = ['received', 'issued'];

    public const PURPOSES = ['rent', 'security_deposit'];

    public const STATUSES = ['pending', 'received', 'issued', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled'];

    /**
     * The statuses a cheque in each direction moves through.
     */
    public const DIRECTION_STATUSES = [
        'received' => ['pending', 'received', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled'],
        'issued' => ['pending', 'issued', 'cleared', 'bounced', 'cancelled'],
    ];

    /**
     * Statuses of a cheque whose money has not moved yet.
     */
    public const OPEN_STATUSES = ['pending', 'received', 'issued', 'deposited'];

    /**
     * Statuses before the cheque reaches the bank, while its date, amount and details can still change.
     */
    public const EDITABLE_STATUSES = ['pending', 'received', 'issued'];

    /**
     * The step that takes a cheque into each stage. The others (expected,
     * in hand, handed over) follow from whether its details are recorded.
     */
    public const STAGE_ACTIONS = ['deposited' => 'deposit', 'cleared' => 'clear', 'bounced' => 'bounce', 'returned' => 'return', 'cancelled' => 'cancel'];

    /**
     * The disk holding cheque photos.
     */
    public const IMAGE_DISK = 'local';

    /**
     * Setting the stage sets the company's status for it too: the one the
     * cheque already has when it stays in its stage, otherwise the stage's
     * first. Kept here rather than in a model event so it holds while seeding.
     *
     * @return Attribute<string, string>
     */
    protected function status(): Attribute
    {
        return Attribute::make(set: function (string $stage, array $attributes): array {
            if (($attributes['status'] ?? null) === $stage && isset($attributes['cheque_status_id'])) {
                return ['status' => $stage];
            }

            $this->unsetRelation('chequeStatus');

            return ['status' => $stage, 'cheque_status_id' => ChequeStatus::firstIn($stage)?->id];
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'period_start' => 'date',
            'period_end' => 'date',
            'cheque_date' => 'date',
            'amount' => 'decimal:2',
            'handed_over_on' => 'date',
            'deposited_on' => 'date',
            'cleared_on' => 'date',
            'bounced_on' => 'date',
        ];
    }

    /**
     * The periods a schedule of cheques covers, one every `$months` months
     * from `$start`, the last one cut short at `$end`. Chained periods each
     * start the day after the previous one ends, as invoices do; anchored
     * ones start `$months` apart from `$start`, as landlord instalments do.
     *
     * @return list<array{0: CarbonImmutable, 1: CarbonImmutable}>
     */
    public static function periods(CarbonInterface $start, CarbonInterface $end, int $months, bool $chained = true): array
    {
        $start = $start->toImmutable()->startOfDay();
        $end = $end->toImmutable()->startOfDay();
        $periods = [];
        $from = $start;

        for ($index = 1; $index <= 600 && $from->lte($end); $index++) {
            $next = $chained ? $from->addMonthsNoOverflow($months) : $start->addMonthsNoOverflow($months * $index);
            $to = $next->subDay();
            $periods[] = [$from, $to->gt($end) ? $end : $to];
            $from = $next;
        }

        return $periods;
    }

    /**
     * The agreement year that today falls in (the first one before it starts,
     * the last one after it ends). Cheques dated up to the end of this year
     * must be collected now, with their photo; later ones can follow.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function currentYear(CarbonInterface $start, CarbonInterface $end, ?CarbonInterface $today = null): array
    {
        $today = ($today ?? today())->toImmutable();
        $yearStart = $start->toImmutable()->startOfDay();

        while ($yearStart->addYearNoOverflow()->lte($today) && $yearStart->addYearNoOverflow()->lte($end)) {
            $yearStart = $yearStart->addYearNoOverflow();
        }

        $yearEnd = $yearStart->addYearNoOverflow()->subDay();

        return [$yearStart, $yearEnd->gt($end) ? $end->toImmutable()->startOfDay() : $yearEnd];
    }

    /**
     * The key of a place in a schedule, such as "rent:3".
     */
    public static function key(string $purpose, int $sequence): string
    {
        return "{$purpose}:{$sequence}";
    }

    public function scheduleKey(): string
    {
        return self::key($this->purpose, $this->sequence);
    }

    /**
     * The status of a cheque with its details recorded: in hand for one
     * received, handed over for one issued.
     */
    public function heldStatus(): string
    {
        return $this->direction === 'received' ? 'received' : 'issued';
    }

    public function hasDetails(): bool
    {
        return filled($this->cheque_number) && filled($this->bank_name);
    }

    public function isEditable(): bool
    {
        return in_array($this->status, self::EDITABLE_STATUSES, true);
    }

    public function isOpen(): bool
    {
        return in_array($this->status, self::OPEN_STATUSES, true);
    }

    /**
     * An open cheque whose date has passed: one to deposit (received) or to
     * hand over (issued, still pending).
     */
    public function isOverdue(): bool
    {
        return in_array($this->status, ['pending', 'received'], true) && $this->cheque_date->lt(today());
    }

    /**
     * Still waiting for its details although its agreement year has come.
     * A room rental's cheques have no schedule, so they are never due this way.
     */
    public function isDueNow(): bool
    {
        if ($this->status !== 'pending' || ! $this->chequeable || $this->chequeable instanceof RoomRental) {
            return false;
        }

        [, $yearEnd] = $this->chequeable->currentChequeYear();

        return $this->cheque_date->lte($yearEnd);
    }

    /**
     * What can happen to the cheque next.
     *
     * @return list<string>
     */
    public function allowedActions(): array
    {
        if ($this->direction === 'received') {
            return match ($this->status) {
                'pending' => ['cancel'],
                'received' => ['deposit', 'return', 'cancel'],
                'deposited' => ['clear', 'bounce'],
                'cleared' => ['bounce'],
                default => [],
            };
        }

        return match ($this->status) {
            'pending' => ['cancel'],
            'issued' => ['clear', 'bounce', 'cancel'],
            'cleared' => ['bounce'],
            default => [],
        };
    }

    public function canBeReplaced(): bool
    {
        return $this->status === 'bounced' && ! $this->replacement()->exists();
    }

    /**
     * Whether the cheque can move to `$status` now: another status of the
     * stage it is in, or one of a stage its next step leads to.
     */
    public function canMoveTo(ChequeStatus $status): bool
    {
        if ($status->id === $this->cheque_status_id) {
            return false;
        }

        return $status->stage === $this->status || in_array(self::STAGE_ACTIONS[$status->stage] ?? null, $this->allowedActions(), true);
    }

    /**
     * Move the cheque to one of the company's statuses on `$on`, noting it
     * in its history. Another status of the same stage only changes what
     * the cheque is called; one of a later stage takes the step into it
     * (deposit, clear, bounce, hand back or cancel) with all that it does.
     *
     * @throws ValidationException When the cheque cannot move to that status now.
     */
    public function moveTo(ChequeStatus $status, CarbonInterface $on, ?string $note = null, ?string $reason = null, ?User $by = null): void
    {
        if (! $this->canMoveTo($status)) {
            throw ValidationException::withMessages(['cheque_status_id' => "This cheque cannot move to {$status->name} from {$this->chequeStatus?->name}."]);
        }

        DB::transaction(function () use ($status, $on, $note, $reason, $by) {
            $previousId = $this->cheque_status_id;

            match ($status->stage === $this->status ? 'rename' : self::STAGE_ACTIONS[$status->stage]) {
                'rename' => $this->forceFill(['cheque_status_id' => $status->id])->save(),
                'deposit' => $this->deposit($on, $status),
                'clear' => $this->clear($on, $status),
                'bounce' => $this->bounce($on, $reason, $status),
                'return' => $this->markReturned($on, $note, $status),
                'cancel' => $this->cancel($note, $status),
            };

            $this->recordUpdate($previousId, $on, implode(' · ', array_filter([$reason, $note], 'filled')) ?: null, $by);
        });
    }

    /**
     * Fill in what the user entered for this cheque: an adjusted date or
     * amount, the cheque's details and its photos. A cheque with its number
     * and bank recorded counts as in hand (or handed over); without them it
     * is still expected.
     *
     * @param  array<string, mixed>  $entry
     */
    public function applyEntry(array $entry, ?User $by = null): void
    {
        foreach (['cheque_date', 'amount'] as $field) {
            if (filled($entry[$field] ?? null)) {
                $this->{$field} = $entry[$field];
            }
        }

        foreach (['cheque_number', 'bank_name', 'account_holder'] as $field) {
            if (array_key_exists($field, $entry)) {
                $this->{$field} = filled($entry[$field]) ? trim((string) $entry[$field]) : null;
            }
        }

        $this->recorded_by ??= $by?->id;
        $this->save();

        foreach (['front', 'back'] as $side) {
            if (! empty($entry["remove_{$side}_image"])) {
                $this->removeImage($side);
            }

            if (($entry["{$side}_image"] ?? null) instanceof UploadedFile) {
                $this->storeImage($entry["{$side}_image"], $side);
            }
        }

        $this->refreshHeldStatus($by);
    }

    /**
     * Keep a not-yet-presented cheque's status in step with its details,
     * noting it in the history when the details move it in or out of hand.
     */
    public function refreshHeldStatus(?User $by = null): void
    {
        if (! $this->isEditable()) {
            return;
        }

        $status = $this->hasDetails() ? $this->heldStatus() : 'pending';
        $previousId = $this->cheque_status_id;
        $changed = $status !== $this->status;

        $this->forceFill([
            'status' => $status,
            'handed_over_on' => $status === 'pending' ? null : ($this->handed_over_on ?? today()),
        ])->save();

        if ($changed) {
            $this->recordUpdate($previousId, today(), null, $by);
        }
    }

    /**
     * Save a photo of one side of the cheque, replacing any earlier one.
     */
    public function storeImage(UploadedFile $file, string $side): void
    {
        $this->removeImage($side);

        $path = $file->storeAs(
            "cheques/{$this->company_id}/{$this->id}",
            "{$side}-".Str::random(12).'.'.($file->extension() ?: 'jpg'),
            self::IMAGE_DISK,
        );

        $this->forceFill(["{$side}_image_path" => $path])->save();
    }

    public function removeImage(string $side): void
    {
        $column = "{$side}_image_path";

        if ($this->{$column}) {
            Storage::disk(self::IMAGE_DISK)->delete($this->{$column});
            $this->forceFill([$column => null])->save();
        }
    }

    /**
     * Delete a planned cheque that the schedule no longer has, with its photos.
     */
    public function discard(): void
    {
        Storage::disk(self::IMAGE_DISK)->delete(array_filter([$this->front_image_path, $this->back_image_path]));
        $this->delete();
    }

    /**
     * Take a received cheque to the bank.
     *
     * @throws ValidationException When the cheque cannot be deposited now.
     */
    public function deposit(CarbonInterface $on, ?ChequeStatus $as = null): void
    {
        $this->ensureAllowed('deposit');

        if ($this->chequeable instanceof Contract && $this->chequeable->status === 'draft') {
            throw ValidationException::withMessages(['action' => 'Activate the contract before depositing its cheques.']);
        }

        $this->forceFill(['status' => 'deposited', 'deposited_on' => $on, ...$this->named($as)])->save();
    }

    /**
     * Record that the money moved. A client's cheque becomes a cleared
     * Payment on the contract, applied to the invoice for the period it
     * covers (billing that period first if needed) and then to the oldest
     * unpaid invoices. A tenant's cheque becomes a receipt on their rental.
     *
     * @throws ValidationException When the cheque cannot clear now.
     */
    public function clear(CarbonInterface $on, ?ChequeStatus $as = null): void
    {
        $this->ensureAllowed('clear');

        DB::transaction(function () use ($on, $as) {
            $this->forceFill(['status' => 'cleared', 'cleared_on' => $on, ...$this->named($as)])->save();

            if ($this->direction !== 'received') {
                return;
            }

            if ($this->chequeable instanceof Contract) {
                $this->settleContract($this->chequeable, $on);
            } elseif ($this->chequeable instanceof RoomRental) {
                $this->chequeable->settleCheque($this, $on);
            }
        });
    }

    /**
     * Record that the cheque was returned unpaid; a client payment made from
     * it no longer counts towards its invoices, and a tenant's receipt from
     * it is voided.
     *
     * @throws ValidationException When the cheque cannot bounce now.
     */
    public function bounce(CarbonInterface $on, ?string $reason = null, ?ChequeStatus $as = null): void
    {
        $this->ensureAllowed('bounce');

        DB::transaction(function () use ($on, $reason, $as) {
            $this->forceFill(['status' => 'bounced', 'bounced_on' => $on, 'bounce_reason' => $reason, ...$this->named($as)])->save();
            $this->payment?->changeStatus('bounced');
            $this->rentalPayment?->void($on, 'The cheque bounced.');
        });
    }

    /**
     * Hand a received cheque back to the client uncashed, such as a
     * security deposit at the end of the contract.
     *
     * @throws ValidationException When the cheque is not in hand.
     */
    public function markReturned(CarbonInterface $on, ?string $note = null, ?ChequeStatus $as = null): void
    {
        $this->ensureAllowed('return');

        $this->forceFill(['status' => 'returned', 'handed_over_on' => $on, 'notes' => $this->appendNote($note), ...$this->named($as)])->save();
    }

    /**
     * @throws ValidationException When the cheque has already been presented.
     */
    public function cancel(?string $note = null, ?ChequeStatus $as = null): void
    {
        $this->ensureAllowed('cancel');

        $this->forceFill(['status' => 'cancelled', 'notes' => $this->appendNote($note), ...$this->named($as)])->save();
    }

    /**
     * A new cheque for the same place in the schedule, standing in for this
     * bounced one.
     *
     * @param  array<string, mixed>  $entry
     *
     * @throws ValidationException When the cheque has not bounced or is already replaced.
     */
    public function replaceWith(array $entry, ?User $by = null): Cheque
    {
        if (! $this->canBeReplaced()) {
            throw ValidationException::withMessages(['action' => 'Only a bounced cheque that has not been replaced yet can be replaced.']);
        }

        return DB::transaction(function () use ($entry, $by) {
            $replacement = $this->replicate([
                'cheque_number', 'bank_name', 'account_holder', 'front_image_path', 'back_image_path', 'status', 'cheque_status_id',
                'handed_over_on', 'deposited_on', 'cleared_on', 'bounced_on', 'bounce_reason', 'notes', 'recorded_by',
            ]);
            $replacement->forceFill(['status' => 'pending', 'replaces_id' => $this->id])->save();
            $replacement->applyEntry($entry, $by);

            return $replacement;
        });
    }

    /**
     * @throws ValidationException
     */
    private function ensureAllowed(string $action): void
    {
        if (! in_array($action, $this->allowedActions(), true)) {
            throw ValidationException::withMessages(['action' => "This cheque cannot be marked as {$this->actionWord($action)} while it is {$this->status}."]);
        }
    }

    private function actionWord(string $action): string
    {
        return match ($action) {
            'deposit' => 'deposited',
            'clear' => 'cleared',
            'bounce' => 'bounced',
            'return' => 'returned',
            default => 'cancelled',
        };
    }

    /**
     * The chosen status to enter a stage in, set after the stage so it wins
     * over the stage's first.
     *
     * @return array{cheque_status_id?: int}
     */
    private function named(?ChequeStatus $status): array
    {
        return $status ? ['cheque_status_id' => $status->id] : [];
    }

    /**
     * Note in the history that the cheque moved to the status it is in now.
     */
    private function recordUpdate(?int $previousStatusId, CarbonInterface $on, ?string $note, ?User $by): void
    {
        $this->updates()->create([
            'cheque_status_id' => $this->cheque_status_id,
            'previous_status_id' => $previousStatusId,
            'changed_on' => $on,
            'note' => $note,
            'user_id' => $by?->id,
        ]);
    }

    private function appendNote(?string $note): ?string
    {
        return filled($note) ? trim(implode("\n", array_filter([$this->notes, $note]))) : $this->notes;
    }

    private function settleContract(Contract $contract, CarbonInterface $on): void
    {
        $contract->invoiceThrough($this->period_start ?? $this->cheque_date);

        $payment = new Payment([
            'received_on' => $on,
            'amount' => $this->amount,
            'method' => 'cheque',
            'status' => 'cleared',
            'reference' => "Cheque {$this->sequence} · {$contract->contract_number}",
            'cheque_number' => $this->cheque_number,
            'cheque_date' => $this->cheque_date,
            'bank_name' => $this->bank_name,
        ]);
        $payment->forceFill([
            'company_id' => $this->company_id,
            'client_id' => $contract->client_id,
            'cheque_id' => $this->id,
            'payment_number' => Payment::nextNumber($this->company_id, $on),
        ])->save();

        $remaining = (float) $this->amount;
        $amounts = [];

        // The rent invoice for the cheque's own period first, then other rent, then gas bills.
        $invoices = $contract->invoices()
            ->whereIn('status', ['issued', 'partially_paid'])
            ->orderByRaw("case when kind = 'rent' and period_start = ? then 0 when kind = 'rent' then 1 else 2 end", [($this->period_start ?? $this->cheque_date)->toDateString()])
            ->orderBy('period_start')
            ->orderBy('id')
            ->get();

        foreach ($invoices as $invoice) {
            if ($remaining <= 0) {
                break;
            }

            $share = min($remaining, round((float) $invoice->total - (float) $invoice->amount_paid, 2));

            if ($share > 0) {
                $amounts[$invoice->id] = $share;
                $remaining = round($remaining - $share, 2);
            }
        }

        $payment->allocate($amounts);
    }

    /**
     * @param  Builder<Cheque>  $query
     */
    #[Scope]
    protected function open(Builder $query): void
    {
        $query->whereIn('cheques.status', self::OPEN_STATUSES);
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * The company's name for where the cheque stands, one of the stage in `status`.
     *
     * @return BelongsTo<ChequeStatus, $this>
     */
    public function chequeStatus(): BelongsTo
    {
        return $this->belongsTo(ChequeStatus::class);
    }

    /**
     * The cheque's history of status changes.
     *
     * @return HasMany<ChequeUpdate, $this>
     */
    public function updates(): HasMany
    {
        return $this->hasMany(ChequeUpdate::class);
    }

    /**
     * The agreement the cheque pays under: a Contract, a HeadLease or a RoomRental.
     *
     * @return MorphTo<Model, $this>
     */
    public function chequeable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<Cheque, $this>
     */
    public function replaces(): BelongsTo
    {
        return $this->belongsTo(Cheque::class, 'replaces_id');
    }

    /**
     * @return HasOne<Cheque, $this>
     */
    public function replacement(): HasOne
    {
        return $this->hasOne(Cheque::class, 'replaces_id');
    }

    /**
     * The client payment made by clearing this cheque.
     *
     * @return HasOne<Payment, $this>
     */
    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    /**
     * The tenant's receipt made by clearing this cheque, under a room rental.
     *
     * @return HasOne<RentalPayment, $this>
     */
    public function rentalPayment(): HasOne
    {
        return $this->hasOne(RentalPayment::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
