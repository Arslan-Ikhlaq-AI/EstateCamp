<?php

namespace App\Models\Concerns;

use App\Models\Settlement;
use App\Models\User;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Extra money the company holds until it is settled: paid on to someone, or
 * handed back, in one go or in parts. What has been received and not yet
 * settled is the money still in hand.
 *
 * The model has `amount`, `settled_amount` and a `status` of `received`
 * or `cancelled`, and may have `pending` for money still to arrive.
 */
trait HasSettlements
{
    /**
     * Where the money stands: still to arrive, all in hand, partly settled,
     * fully settled, or no longer counted.
     */
    public const STANDINGS = ['to_collect', 'held', 'part_settled', 'settled', 'cancelled'];

    /**
     * Where the money stands, as STANDINGS names it.
     */
    public function standing(): string
    {
        return match (true) {
            $this->status === 'cancelled' => 'cancelled',
            $this->status === 'pending' => 'to_collect',
            (float) $this->settled_amount <= 0 => 'held',
            (float) $this->settled_amount < (float) $this->amount => 'part_settled',
            default => 'settled',
        };
    }

    /**
     * The same as standing(), as a SQL expression for counting and filtering.
     */
    public static function standingSql(): string
    {
        return "case when status = 'cancelled' then 'cancelled'"
            ." when status = 'pending' then 'to_collect'"
            ." when settled_amount <= 0 then 'held'"
            ." when settled_amount < amount then 'part_settled'"
            ." else 'settled' end";
    }

    /**
     * Money received and not yet settled.
     */
    public function remaining(): float
    {
        return $this->status === 'received' ? round((float) $this->amount - (float) $this->settled_amount, 2) : 0.0;
    }

    /**
     * Pay out part or all of what is left. The record is locked while the
     * balance is checked, so two settlements at once cannot overspend it.
     *
     * @param  array{settled_on: mixed, amount: mixed, method: string, paid_to?: ?string, reference?: ?string, notes?: ?string}  $details
     *
     * @throws ValidationException When the money has not arrived or is less than the amount.
     */
    public function settle(array $details, ?User $by = null): Settlement
    {
        return DB::transaction(function () use ($details, $by) {
            $current = static::query()->withoutGlobalScopes()->lockForUpdate()->findOrFail($this->getKey());
            $held = $current->remaining();

            if ($current->status !== 'received') {
                throw ValidationException::withMessages(['amount' => 'Only money that has been received can be settled.']);
            }

            if ((float) $details['amount'] > $held + 0.005) {
                throw ValidationException::withMessages(['amount' => "Only {$held} is left to settle."]);
            }

            $optional = fn (string $key) => filled($details[$key] ?? null) ? trim($details[$key]) : null;

            $settlement = new Settlement([
                'settled_on' => $details['settled_on'],
                'amount' => $details['amount'],
                'method' => $details['method'],
                'paid_to' => $optional('paid_to'),
                'reference' => $optional('reference'),
                'notes' => $optional('notes'),
            ]);
            $settlement->forceFill(['company_id' => $this->company_id, 'created_by' => $by?->id]);
            $this->settlements()->save($settlement);
            $this->recountSettled();

            return $settlement;
        });
    }

    /**
     * Take back a settlement entered by mistake, returning its money to
     * what is in hand.
     */
    public function undoSettlement(Settlement $settlement): void
    {
        DB::transaction(function () use ($settlement) {
            $settlement->delete();
            $this->recountSettled();
        });
    }

    /**
     * Bring `settled_amount` back in line with the settlements.
     */
    public function recountSettled(): void
    {
        $this->forceFill(['settled_amount' => round((float) $this->settlements()->sum('amount'), 2)])->save();
    }

    /**
     * Records standing any of the `$standings` ways.
     *
     * @param  Builder<static>  $query
     * @param  list<string>  $standings
     */
    #[Scope]
    protected function standingIn(Builder $query, array $standings): void
    {
        $query->whereIn(DB::raw(static::standingSql()), $standings);
    }

    /**
     * What has been paid out of this record, oldest first.
     *
     * @return MorphMany<Settlement, $this>
     */
    public function settlements(): MorphMany
    {
        return $this->morphMany(Settlement::class, 'settleable');
    }
}
