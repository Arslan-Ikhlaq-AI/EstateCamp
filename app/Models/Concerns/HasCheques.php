<?php

namespace App\Models\Concerns;

use App\Models\Cheque;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Facades\DB;

/**
 * An agreement paid by a schedule of cheques: one for the security deposit
 * (when there is one) and one rent cheque per payment period over the term.
 *
 * The using model has `company_id`, `start_date`, `end_date` and
 * `security_deposit`, and says which way its cheques go, how many months
 * each rent cheque covers and what each one is for.
 */
trait HasCheques
{
    /**
     * `received` for cheques the company collects, `issued` for ones it writes.
     */
    abstract public function chequeDirection(): string;

    /**
     * How many months one rent cheque covers.
     */
    abstract public function monthsPerCheque(): int;

    /**
     * The amount of the rent cheque covering `$from` to `$to`.
     */
    abstract public function plannedChequeAmount(CarbonImmutable $from, CarbonImmutable $to): float;

    /**
     * Whether rent periods follow one another (true) or start a fixed number
     * of months from the start date (false).
     */
    protected function chainsChequePeriods(): bool
    {
        return true;
    }

    /**
     * Called before planning, so the plan reads the agreement's latest terms.
     */
    protected function refreshChequeTerms(): void
    {
        //
    }

    /**
     * @return MorphMany<Cheque, $this>
     */
    public function cheques(): MorphMany
    {
        return $this->morphMany(Cheque::class, 'chequeable');
    }

    /**
     * The cheques the current terms call for, in order: the security deposit
     * first (on the start date), then one rent cheque per period, dated on
     * the first day it covers.
     *
     * @return list<array{purpose: string, sequence: int, period_start: ?string, period_end: ?string, cheque_date: string, amount: float}>
     */
    public function plannedCheques(): array
    {
        $this->refreshChequeTerms();

        $plan = [];

        if ((float) $this->security_deposit > 0) {
            $plan[] = [
                'purpose' => 'security_deposit',
                'sequence' => 1,
                'period_start' => null,
                'period_end' => null,
                'cheque_date' => $this->start_date->toDateString(),
                'amount' => round((float) $this->security_deposit, 2),
            ];
        }

        foreach (Cheque::periods($this->start_date, $this->end_date, $this->monthsPerCheque(), $this->chainsChequePeriods()) as $index => [$from, $to]) {
            $amount = $this->plannedChequeAmount($from, $to);

            if ($amount <= 0) {
                continue;
            }

            $plan[] = [
                'purpose' => 'rent',
                'sequence' => $index + 1,
                'period_start' => $from->toDateString(),
                'period_end' => $to->toDateString(),
                'cheque_date' => $from->toDateString(),
                'amount' => $amount,
            ];
        }

        return $plan;
    }

    /**
     * The agreement year today falls in; its cheques (and any earlier ones)
     * must be collected now.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public function currentChequeYear(): array
    {
        return Cheque::currentYear($this->start_date, $this->end_date);
    }

    /**
     * Bring the cheques in line with the terms and record what the user
     * entered for them, keyed by place in the schedule ("rent:3").
     *
     * While no cheque has reached the bank, the schedule is rebuilt from the
     * terms: places it no longer has are dropped and new ones are added.
     * After that it is kept as it is, and only cheques not yet presented
     * take the entries. Returns whether the schedule was rebuilt.
     *
     * @param  array<string, array<string, mixed>>  $entries
     */
    public function syncCheques(array $entries = [], ?User $by = null): bool
    {
        return DB::transaction(function () use ($entries, $by) {
            $existing = $this->cheques()->whereNull('replaces_id')->get()->keyBy(fn (Cheque $cheque) => $cheque->scheduleKey());
            $rebuild = $existing->every(fn (Cheque $cheque) => $cheque->isEditable());

            if ($rebuild) {
                $plan = collect($this->plannedCheques())->keyBy(fn (array $row) => Cheque::key($row['purpose'], $row['sequence']));

                $existing->except($plan->keys()->all())->each(fn (Cheque $cheque) => $cheque->discard());

                $cheques = $plan->map(fn (array $row, string $key) => ($existing->get($key) ?? $this->newCheque())->forceFill($row));
            } else {
                $cheques = $existing->filter(fn (Cheque $cheque) => $cheque->isEditable());
            }

            foreach ($cheques as $key => $cheque) {
                $cheque->applyEntry($entries[$key] ?? [], $by);
            }

            return $rebuild;
        });
    }

    /**
     * A planned cheque under this agreement, still to be collected or written.
     */
    protected function newCheque(): Cheque
    {
        $cheque = new Cheque;
        $cheque->forceFill([
            'company_id' => $this->company_id,
            'direction' => $this->chequeDirection(),
            'chequeable_type' => $this->getMorphClass(),
            'chequeable_id' => $this->getKey(),
            'status' => 'pending',
        ]);

        return $cheque;
    }
}
