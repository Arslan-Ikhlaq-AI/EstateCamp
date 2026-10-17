<?php

namespace App\Http\Requests;

use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Money received from a client and how it is spread over their invoices.
 */
class PaymentRequest extends CompanyScopedRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'client_id' => ['required', 'integer', $this->existsInCompany('clients')],
            'received_on' => ['required', 'date', 'before_or_equal:today'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'method' => ['required', Rule::in(Payment::METHODS)],
            'status' => ['required_if:method,cheque', 'nullable', Rule::in(['pending', 'cleared'])],
            'reference' => ['nullable', 'string', 'max:100'],
            'cheque_number' => ['required_if:method,cheque', 'nullable', 'string', 'max:30'],
            'cheque_date' => ['required_if:method,cheque', 'nullable', 'date'],
            'bank_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'allocations' => ['array'],
            'allocations.*.invoice_id' => ['required', 'integer', 'distinct', $this->existsInCompany('invoices', softDeletes: false)],
            'allocations.*.amount' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * Allocations go to the paying client's open invoices, no more than each
     * one still owes, and together no more than the payment.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $allocations = collect($this->input('allocations', []));
                $invoices = Invoice::query()->whereKey($allocations->pluck('invoice_id'))->get()->keyBy('id');

                foreach ($allocations as $index => $allocation) {
                    $invoice = $invoices->get($allocation['invoice_id']);

                    if ($invoice->client_id !== $this->integer('client_id') || $invoice->status === 'void') {
                        $validator->errors()->add("allocations.{$index}.invoice_id", "Invoice {$invoice->invoice_number} is not an open invoice of this client.");
                    } elseif ((float) $allocation['amount'] > $invoice->balance()) {
                        $validator->errors()->add("allocations.{$index}.amount", "Invoice {$invoice->invoice_number} has only {$invoice->balance()} left to pay.");
                    }
                }

                if (round($allocations->sum(fn (array $allocation) => (float) $allocation['amount']), 2) > (float) $this->input('amount')) {
                    $validator->errors()->add('amount', 'The amounts allocated to invoices add up to more than the payment.');
                }
            },
        ];
    }

    /**
     * The payment's own fields. Only cheques can wait to clear; other methods
     * count as received at once and carry no cheque details.
     *
     * @return array<string, mixed>
     */
    public function paymentAttributes(): array
    {
        $attributes = collect($this->validated())->except(['client_id', 'allocations'])->all();

        if ($attributes['method'] !== 'cheque') {
            $attributes = [...$attributes, 'status' => 'cleared', 'cheque_number' => null, 'cheque_date' => null];
        }

        return $attributes;
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'client_id' => 'client',
            'received_on' => 'date received',
            'cheque_date' => 'cheque date',
            'allocations.*.amount' => 'allocated amount',
        ];
    }
}
