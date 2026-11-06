<?php

namespace App\Models\Concerns;

use App\Models\Commission;
use App\Models\Deposit;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Validation\ValidationException;

/**
 * An agreement that can take a commission and a security deposit, each paid
 * by cash or cheque or left for later. Both are kept in tables of their own,
 * so the agreement's rent, invoices and receipts never see them.
 *
 * The model says what a commission percentage is worked out on
 * (commissionBase()) and which property the money sits at
 * (extraPaymentPropertyId()). The deposit's amount is the agreement's
 * `security_deposit`.
 */
trait HasExtraPayments
{
    /**
     * The rent a commission percentage is taken of.
     */
    abstract public function commissionBase(): float;

    /**
     * The property the commission and deposit are listed under.
     */
    abstract public function extraPaymentPropertyId(): ?int;

    /**
     * Save the commission as the form left it, working a percentage out on
     * the agreement's rent.
     *
     * @param  array{type: ?string, rate: mixed, amount: mixed, payment: ?string, cheque_number: ?string, bank_name: ?string, cheque_date: mixed}  $terms
     *
     * @throws ValidationException When that leaves less than has been settled.
     */
    public function syncCommission(array $terms, ?User $by = null): void
    {
        $rate = $terms['type'] === 'percentage' ? round((float) $terms['rate'], 2) : null;

        $amount = match ($terms['type']) {
            'percentage' => round($this->commissionBase() * $rate / 100, 2),
            'amount' => round((float) $terms['amount'], 2),
            default => 0.0,
        };

        $this->syncExtraPayment($this->commission()->first() ?? new Commission, $amount, $terms, $by, 'commission_amount', ['rate' => $rate]);
    }

    /**
     * Save the deposit for the agreement's `security_deposit`.
     *
     * @param  array{payment: ?string, cheque_number: ?string, bank_name: ?string, cheque_date: mixed}  $terms
     *
     * @throws ValidationException When that leaves less than has been settled.
     */
    public function syncDeposit(array $terms, ?User $by = null): void
    {
        $this->syncExtraPayment($this->deposit()->first() ?? new Deposit, round((float) $this->security_deposit, 2), $terms, $by, 'security_deposit');
    }

    /**
     * Create, change or remove a commission or deposit. A cancelled one is
     * left alone until its amount changes. Without a choice of how it is
     * paid, a saved one stays as it is and a new one waits for its money.
     *
     * @param  array{payment: ?string, cheque_number?: ?string, bank_name?: ?string, cheque_date?: mixed}  $terms
     * @param  array<string, mixed>  $columns
     *
     * @throws ValidationException When that leaves less than has been settled.
     */
    private function syncExtraPayment(Model $record, float $amount, array $terms, ?User $by, string $field, array $columns = []): void
    {
        $settled = (float) $record->settled_amount;

        if ($settled > 0 && $amount < $settled) {
            throw ValidationException::withMessages([$field => "{$settled} of this has been settled, so it cannot be less. Undo the settlements first."]);
        }

        if ($amount <= 0) {
            if ($record->exists) {
                $record->delete();
            }

            return;
        }

        if ($record->status === 'cancelled' && (float) $record->amount === $amount) {
            return;
        }

        if (! $record->exists) {
            $record->forceFill([
                'company_id' => $this->company_id,
                $record::NUMBER_COLUMN => $record::nextNumber($this->company_id),
                'agreement_type' => $this->getMorphClass(),
                'agreement_id' => $this->id,
                'created_by' => $by?->id,
            ]);
        }

        $record->forceFill([
            ...$columns,
            'amount' => $amount,
            'client_id' => $this->client_id,
            'property_id' => $this->extraPaymentPropertyId(),
            ...$this->paymentColumns($record, $terms, $field),
        ])->save();
    }

    /**
     * What the form's choice of cash, cheque or later means for `$record`.
     *
     * @param  array{payment: ?string, cheque_number?: ?string, bank_name?: ?string, cheque_date?: mixed}  $terms
     * @return array<string, mixed>
     *
     * @throws ValidationException When money already settled is put back to unpaid.
     */
    private function paymentColumns(Model $record, array $terms, string $field): array
    {
        $choice = $terms['payment'] ?? null;

        if ($choice === null) {
            return $record->exists && $record->status !== 'cancelled' ? [] : ['status' => 'pending', 'received_on' => null, ...$record::paymentColumns(['method' => null])];
        }

        if ($choice === 'later') {
            if ((float) $record->settled_amount > 0) {
                throw ValidationException::withMessages([$field => 'Some of this has been settled, so it stays received. Undo the settlements first.']);
            }

            return ['status' => 'pending', 'received_on' => null, ...$record::paymentColumns(['method' => null])];
        }

        return ['status' => 'received', 'received_on' => $record->received_on ?? today(), ...$record::paymentColumns(['method' => $choice, ...$terms])];
    }

    /**
     * Read from every camp, as an agreement across camps has one commission.
     *
     * @return MorphOne<Commission, $this>
     */
    public function commission(): MorphOne
    {
        return $this->morphOne(Commission::class, 'agreement')->withoutGlobalScope('camps');
    }

    /**
     * Read from every camp, as an agreement across camps has one deposit.
     *
     * @return MorphOne<Deposit, $this>
     */
    public function deposit(): MorphOne
    {
        return $this->morphOne(Deposit::class, 'agreement')->withoutGlobalScope('camps');
    }
}
