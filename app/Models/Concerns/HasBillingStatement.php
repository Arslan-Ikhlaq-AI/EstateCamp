<?php

namespace App\Models\Concerns;

use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * An agreement billed as a running account, the way a tenant statement
 * reads: each charge falls due on a set day and every payment counts
 * against the balance, oldest charge first. A statement for a period opens
 * with the balance brought forward from before it, adds what fell due in
 * it and takes off what was received in it; what is left is carried into
 * the next period's bill.
 *
 * The using model lists its charges and the payments it has received, and
 * records money collected towards them.
 */
trait HasBillingStatement
{
    /**
     * What has fallen due by `$through`, oldest first. Each charge has the
     * day it falls due (`chargedOn`) and the days it covers.
     *
     * @return list<array{key: string, type: string, id: ?int, number: ?string, start: CarbonImmutable, end: CarbonImmutable, chargedOn: CarbonImmutable, amount: float, isPlanned: bool}>
     */
    abstract public function billingCharges(CarbonInterface $through): array;

    /**
     * Every payment received and cleared, oldest first.
     *
     * @return list<array{key: string, id: int, number: string, paidOn: CarbonImmutable, method: string, amount: float}>
     */
    abstract public function billingPayments(): array;

    /**
     * Record `$amount` received today towards what has fallen due by `$through`.
     */
    abstract protected function recordCollection(float $amount, CarbonInterface $through, string $method, ?User $by): Model;

    /**
     * Called before money is collected, so every charge due by `$through`
     * is on record to be paid.
     */
    protected function prepareCollection(CarbonInterface $through): void
    {
        //
    }

    /**
     * The account over `$from` to `$to`: the balance brought forward (owed
     * from before, negative when paid ahead), the charges and payments in
     * the period, the balance carried forward to the next bill, and what is
     * still to pay today of everything that has fallen due by `$to`.
     *
     * @return array{broughtForward: float, charges: list<array<string, mixed>>, charged: float, payments: list<array<string, mixed>>, received: float, carriedForward: float, toPay: float}
     */
    public function billingStatement(CarbonInterface $from, CarbonInterface $to): array
    {
        $from = CarbonImmutable::parse($from)->startOfDay();
        $to = CarbonImmutable::parse($to)->startOfDay();
        $charges = collect($this->billingCharges($to));
        $payments = collect($this->billingPayments());
        $before = fn (string $date) => fn (array $item) => $item[$date]->lt($from);
        $within = fn (string $date) => fn (array $item) => $item[$date]->betweenIncluded($from, $to);

        $broughtForward = round($charges->filter($before('chargedOn'))->sum('amount') - $payments->filter($before('paidOn'))->sum('amount'), 2);
        $periodCharges = $charges->filter($within('chargedOn'))->values();
        $periodPayments = $payments->filter($within('paidOn'))->values();
        $charged = round($periodCharges->sum('amount'), 2);
        $received = round($periodPayments->sum('amount'), 2);

        return [
            'broughtForward' => $broughtForward,
            'charges' => $periodCharges->map(fn (array $charge) => [
                ...$charge,
                'start' => $charge['start']->toDateString(),
                'end' => $charge['end']->toDateString(),
                'chargedOn' => $charge['chargedOn']->toDateString(),
            ])->all(),
            'charged' => $charged,
            'payments' => $periodPayments->map(fn (array $payment) => [...$payment, 'paidOn' => $payment['paidOn']->toDateString()])->all(),
            'received' => $received,
            'carriedForward' => round($broughtForward + $charged - $received, 2),
            'toPay' => $this->owedThrough($charges, $payments),
        ];
    }

    /**
     * What is still to pay today of everything that has fallen due by `$through`.
     */
    public function amountToCollect(CarbonInterface $through): float
    {
        return $this->owedThrough(collect($this->billingCharges($through)), collect($this->billingPayments()));
    }

    /**
     * Collect money received today towards the bill up to `$through`,
     * settling the oldest charges first, so the balance brought forward is
     * cleared before the new charges. Nobody can collect more than is
     * owed, and two people collecting at once wait for each other.
     *
     * @throws ValidationException When the amount is more than is still to pay.
     */
    public function collectPayment(float $amount, CarbonInterface $through, string $method, ?User $by = null): Model
    {
        return DB::transaction(function () use ($amount, $through, $method, $by) {
            static::query()->whereKey($this->getKey())->lockForUpdate()->first();

            $this->prepareCollection($through);
            $owed = $this->amountToCollect($through);

            if ($amount > $owed + 0.005) {
                throw ValidationException::withMessages(['amount' => $owed > 0
                    ? 'Only '.number_format($owed, 2).' is still to pay on this bill.'
                    : 'Nothing is left to pay on this bill.']);
            }

            return $this->recordCollection(round($amount, 2), $through, $method, $by);
        });
    }

    /**
     * @param  Collection<int, array{amount: float}>  $charges
     * @param  Collection<int, array{amount: float}>  $payments
     */
    private function owedThrough(Collection $charges, Collection $payments): float
    {
        return round(max(0, $charges->sum('amount') - $payments->sum('amount')), 2);
    }
}
