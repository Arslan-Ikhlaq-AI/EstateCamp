<?php

namespace App\Http\Requests\Concerns;

use App\Models\MaintenanceJob;
use App\Models\MaintenanceStatus;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * What a maintenance job cost: the amount charged, how and when it was
 * paid (cash, cheque, transfer or card, only as a note of how), the invoice
 * number and the invoice itself (a photo, screenshot or PDF).
 *
 * A job in a finished status must have the amount and the invoice.
 */
trait ValidatesMaintenanceCost
{
    /**
     * @return array<string, array<mixed>>
     */
    protected function costRules(): array
    {
        return [
            'amount' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'payment_method' => ['nullable', Rule::in(MaintenanceJob::PAYMENT_METHODS)],
            'paid_on' => ['nullable', 'date', 'before_or_equal:today'],
            'invoice_number' => ['nullable', 'string', 'max:100'],
            'invoice' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'remove_invoice' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function costAttributes(): array
    {
        return ['amount' => 'amount charged', 'payment_method' => 'payment method', 'paid_on' => 'payment date', 'invoice_number' => 'invoice number'];
    }

    /**
     * The cost as MaintenanceJob::recordCost() takes it, with the invoice file.
     *
     * @return array<string, mixed>
     */
    public function cost(): array
    {
        return [
            ...$this->safe()->only(['amount', 'payment_method', 'paid_on', 'invoice_number']),
            'invoice' => $this->file('invoice'),
            'remove_invoice' => $this->boolean('remove_invoice'),
        ];
    }

    /**
     * Check that a job going into (or already in) a finished `$status` has
     * the amount charged and an invoice: uploaded now, or on file and kept.
     */
    protected function checkFinishedJobCost(Validator $validator, ?MaintenanceStatus $status, ?MaintenanceJob $job): void
    {
        if (! $status?->isCompleted()) {
            return;
        }

        $amount = $this->has('amount') ? $this->input('amount') : $job?->amount;
        $hasInvoice = $this->file('invoice') instanceof UploadedFile || ($job?->invoice_path && ! $this->boolean('remove_invoice'));

        if (blank($amount)) {
            $validator->errors()->add('amount', 'Enter the amount charged for the work.');
        }

        if (! $hasInvoice) {
            $validator->errors()->add('invoice', 'Upload the invoice for the work.');
        }
    }
}
