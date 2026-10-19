<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\ChequeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * One cheque, the main record of money moving under an agreement: received
 * from a client under a Contract, or issued to a landlord under a HeadLease
 * (vendors' service contracts will issue them too).
 *
 * A received cheque goes pending (expected, not collected yet) → received
 * (in hand) → deposited → cleared, or bounces. Clearing it records a client
 * Payment and settles the contract's invoices. An issued cheque goes pending
 * (not written yet) → issued (handed over) → cleared, or bounces. A bounced
 * cheque is replaced by a new one for the same period.
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

    public const ACTIONS = ['deposit', 'clear', 'bounce', 'return', 'cancel'];

    /**
     * The disk holding cheque photos.
     */
    public const IMAGE_DISK = 'local';

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
     */
    public function isDueNow(): bool
    {
        if ($this->status !== 'pending' || ! $this->chequeable) {
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

        $this->refreshHeldStatus();
    }

    /**
     * Keep a not-yet-presented cheque's status in step with its details.
     */
    public function refreshHeldStatus(): void
    {
        if (! $this->isEditable()) {
            return;
        }

        $status = $this->hasDetails() ? $this->heldStatus() : 'pending';

        $this->forceFill([
            'status' => $status,
            'handed_over_on' => $status === 'pending' ? null : ($this->handed_over_on ?? today()),
        ])->save();
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
    public function deposit(CarbonInterface $on): void
    {
        $this->ensureAllowed('deposit');

        if ($this->chequeable instanceof Contract && $this->chequeable->status === 'draft') {
            throw ValidationException::withMessages(['action' => 'Activate the contract before depositing its cheques.']);
        }

        $this->forceFill(['status' => 'deposited', 'deposited_on' => $on])->save();
    }

    /**
     * Record that the money moved. A client's cheque becomes a cleared
     * Payment on the contract, applied to the invoice for the period it
     * covers (billing that period first if needed) and then to the oldest
     * unpaid invoices.
     *
     * @throws ValidationException When the cheque cannot clear now.
     */
    public function clear(CarbonInterface $on): void
    {
        $this->ensureAllowed('clear');

        DB::transaction(function () use ($on) {
            $this->forceFill(['status' => 'cleared', 'cleared_on' => $on])->save();

            if ($this->direction === 'received' && $this->chequeable instanceof Contract) {
                $this->settleContract($this->chequeable, $on);
            }
        });
    }

    /**
     * Record that the cheque was returned unpaid; a client payment made from
     * it no longer counts towards its invoices.
     *
     * @throws ValidationException When the cheque cannot bounce now.
     */
    public function bounce(CarbonInterface $on, ?string $reason = null): void
    {
        $this->ensureAllowed('bounce');

        DB::transaction(function () use ($on, $reason) {
            $this->forceFill(['status' => 'bounced', 'bounced_on' => $on, 'bounce_reason' => $reason])->save();
            $this->payment?->changeStatus('bounced');
        });
    }

    /**
     * Hand a received cheque back to the client uncashed, such as a
     * security deposit at the end of the contract.
     *
     * @throws ValidationException When the cheque is not in hand.
     */
    public function markReturned(CarbonInterface $on, ?string $note = null): void
    {
        $this->ensureAllowed('return');

        $this->forceFill(['status' => 'returned', 'handed_over_on' => $on, 'notes' => $this->appendNote($note)])->save();
    }

    /**
     * @throws ValidationException When the cheque has already been presented.
     */
    public function cancel(?string $note = null): void
    {
        $this->ensureAllowed('cancel');

        $this->forceFill(['status' => 'cancelled', 'notes' => $this->appendNote($note)])->save();
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
                'cheque_number', 'bank_name', 'account_holder', 'front_image_path', 'back_image_path', 'status',
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

        $invoices = $contract->invoices()
            ->whereIn('status', ['issued', 'partially_paid'])
            ->orderByRaw('case when period_start = ? then 0 else 1 end', [($this->period_start ?? $this->cheque_date)->toDateString()])
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
     * The agreement the cheque pays under: a Contract or a HeadLease.
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
     * @return BelongsTo<User, $this>
     */
    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
