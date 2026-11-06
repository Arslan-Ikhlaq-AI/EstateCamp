<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Validation\Rule;

/**
 * The commission and security deposit on an agreement's form. A commission
 * is a percentage of the rent or an exact amount. Each is paid by cash or
 * cheque or left for later, and a cheque needs its number, bank and date.
 * The deposit's amount is the form's `security_deposit`.
 */
trait ValidatesExtraPayments
{
    /**
     * @return array<string, array<mixed>>
     */
    protected function extraPaymentRules(): array
    {
        $type = $this->input('commission_type');
        $isCommissionCheque = in_array($type, ['percentage', 'amount'], true) && $this->input('commission_payment') === 'cheque';
        $isDepositCheque = (float) $this->input('security_deposit') > 0 && $this->input('deposit_payment') === 'cheque';
        $paidBy = ['nullable', Rule::in(['cash', 'cheque', 'later'])];

        return [
            'commission_type' => ['nullable', Rule::in(['none', 'percentage', 'amount'])],
            'commission_rate' => [Rule::requiredIf($type === 'percentage'), 'nullable', 'numeric', 'gt:0', 'max:100'],
            'commission_amount' => [Rule::requiredIf($type === 'amount'), 'nullable', 'numeric', 'gt:0', 'max:100000000'],
            'commission_payment' => $paidBy,
            'commission_cheque_number' => [Rule::requiredIf($isCommissionCheque), 'nullable', 'string', 'max:30'],
            'commission_bank_name' => [Rule::requiredIf($isCommissionCheque), 'nullable', 'string', 'max:255'],
            'commission_cheque_date' => [Rule::requiredIf($isCommissionCheque), 'nullable', 'date'],
            'deposit_payment' => $paidBy,
            'deposit_cheque_number' => [Rule::requiredIf($isDepositCheque), 'nullable', 'string', 'max:30'],
            'deposit_bank_name' => [Rule::requiredIf($isDepositCheque), 'nullable', 'string', 'max:255'],
            'deposit_cheque_date' => [Rule::requiredIf($isDepositCheque), 'nullable', 'date'],
        ];
    }

    /**
     * The commission as HasExtraPayments::syncCommission() takes it.
     *
     * @return array{type: ?string, rate: mixed, amount: mixed, payment: ?string, cheque_number: ?string, bank_name: ?string, cheque_date: mixed}
     */
    public function commissionTerms(): array
    {
        return [
            'type' => $this->validated('commission_type'),
            'rate' => $this->validated('commission_rate'),
            'amount' => $this->validated('commission_amount'),
            'payment' => $this->validated('commission_payment'),
            'cheque_number' => $this->validated('commission_cheque_number'),
            'bank_name' => $this->validated('commission_bank_name'),
            'cheque_date' => $this->validated('commission_cheque_date'),
        ];
    }

    /**
     * The deposit as HasExtraPayments::syncDeposit() takes it.
     *
     * @return array{payment: ?string, cheque_number: ?string, bank_name: ?string, cheque_date: mixed}
     */
    public function depositTerms(): array
    {
        return [
            'payment' => $this->validated('deposit_payment'),
            'cheque_number' => $this->validated('deposit_cheque_number'),
            'bank_name' => $this->validated('deposit_bank_name'),
            'cheque_date' => $this->validated('deposit_cheque_date'),
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function extraPaymentAttributes(): array
    {
        return [
            'commission_type' => 'commission',
            'commission_rate' => 'commission percentage',
            'commission_amount' => 'commission amount',
            'commission_payment' => 'how the commission is paid',
            'commission_cheque_number' => 'commission cheque number',
            'commission_bank_name' => 'commission cheque bank',
            'commission_cheque_date' => 'commission cheque date',
            'deposit_payment' => 'how the deposit is paid',
            'deposit_cheque_number' => 'deposit cheque number',
            'deposit_bank_name' => 'deposit cheque bank',
            'deposit_cheque_date' => 'deposit cheque date',
        ];
    }
}
