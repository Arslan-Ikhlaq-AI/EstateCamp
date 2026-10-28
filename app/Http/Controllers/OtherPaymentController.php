<?php

namespace App\Http\Controllers;

use App\Http\Requests\OtherPaymentRequest;
use App\Http\Requests\OtherPaymentStatusRequest;
use App\Models\Company;
use App\Models\OtherPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * One-off payments the company makes for a property that are neither rent,
 * a maintenance contract nor a maintenance job, added from the property's
 * payments page and listed there with the other money going out.
 */
class OtherPaymentController extends Controller
{
    /**
     * Show the form for a new payment, for the property it was opened from.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $property = $company->properties()->find($request->integer('property'));

        return Inertia::render('OtherPayments/Form', [
            'payment' => null,
            'defaults' => ['property_id' => $property?->id],
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Save a new payment, paid now or left to pay, and go back to the
     * property's money going out.
     */
    public function store(OtherPaymentRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);
        $property = $company->properties()->findOrFail($request->validated('property_id'));

        $payment = DB::transaction(function () use ($request, $company, $property) {
            $payment = new OtherPayment($request->details());
            $payment->forceFill([
                'company_id' => $company->id,
                'property_id' => $property->id,
                'payment_number' => OtherPayment::nextNumber($company->id),
                'status' => $request->validated('status'),
                'created_by' => $request->user()->id,
                'paid_by' => $request->isPaid() ? $request->user()->id : null,
            ])->save();
            $this->syncReceipt($payment, $request);

            return $payment;
        });

        $done = $payment->isPaid() ? 'was paid' : 'was added, still to pay';

        return to_route('properties.payments', ['property' => $property, 'tab' => 'out'])
            ->with('success', "{$payment->payment_number} to {$payment->paid_to} {$done}.");
    }

    /**
     * Show the form for correcting a payment; its status changes on the payments page.
     */
    public function edit(Request $request, OtherPayment $otherPayment): Response
    {
        $this->ensureSameCompany($request, $otherPayment);

        return Inertia::render('OtherPayments/Form', [
            'payment' => [
                'id' => $otherPayment->id,
                'number' => $otherPayment->payment_number,
                'status' => $otherPayment->status,
                ...$otherPayment->only(['property_id', 'title', 'paid_to', 'method', 'reference', 'notes', 'receipt_name']),
                'amount' => (float) $otherPayment->amount,
                'payment_date' => $otherPayment->payment_date->toDateString(),
                'receipt_url' => self::receiptUrl($otherPayment),
            ],
            'defaults' => null,
            ...$this->formOptions($otherPayment->company),
        ]);
    }

    public function update(OtherPaymentRequest $request, OtherPayment $otherPayment): RedirectResponse
    {
        $property = $otherPayment->company->properties()->findOrFail($request->validated('property_id'));

        DB::transaction(function () use ($request, $otherPayment, $property) {
            $otherPayment->fill($request->details());
            $otherPayment->property_id = $property->id;
            $otherPayment->save();
            $this->syncReceipt($otherPayment, $request);
        });

        return to_route('properties.payments', ['property' => $property, 'tab' => 'out'])
            ->with('success', "{$otherPayment->payment_number} was updated.");
    }

    /**
     * Mark a payment paid (on a day, and how), put it back as still to pay,
     * or cancel it.
     */
    public function changeStatus(OtherPaymentStatusRequest $request, OtherPayment $otherPayment): RedirectResponse
    {
        $status = $request->validated('status');

        match ($status) {
            'paid' => $otherPayment->markPaid($request->date('date'), $request->validated('method'), $request->user()),
            'pending' => $otherPayment->markPending(),
            'cancelled' => $otherPayment->cancel(),
        };

        $message = match ($status) {
            'paid' => 'was paid',
            'pending' => 'is to pay again',
            'cancelled' => 'was cancelled',
        };

        return back()->with('success', "{$otherPayment->payment_number} {$message}.");
    }

    /**
     * A payment's receipt, for the company's own users only.
     */
    public function receipt(Request $request, OtherPayment $otherPayment): StreamedResponse
    {
        $this->ensureSameCompany($request, $otherPayment);

        $path = $otherPayment->receipt_path;

        abort_unless($path && Storage::disk(OtherPayment::RECEIPT_DISK)->exists($path), 404);

        return Storage::disk(OtherPayment::RECEIPT_DISK)->response($path, $otherPayment->receipt_name, ['Cache-Control' => 'private, max-age=3600']);
    }

    /**
     * One payment as the property's payments page lists it.
     *
     * @return array<string, mixed>
     */
    public static function details(OtherPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'number' => $payment->payment_number,
            'title' => $payment->title,
            'paidTo' => $payment->paid_to,
            'amount' => (float) $payment->amount,
            'status' => $payment->status,
            'date' => $payment->payment_date->toDateString(),
            'method' => $payment->method,
            'reference' => $payment->reference,
            'notes' => $payment->notes,
            'receiptUrl' => self::receiptUrl($payment),
            'isOverdue' => $payment->status === 'pending' && $payment->payment_date->lt(today()),
        ];
    }

    private static function receiptUrl(OtherPayment $payment): ?string
    {
        return $payment->receipt_path ? route('other-payments.receipt', [$payment, 'v' => $payment->updated_at?->timestamp]) : null;
    }

    /**
     * Replace or remove the receipt as the form asked.
     */
    private function syncReceipt(OtherPayment $payment, OtherPaymentRequest $request): void
    {
        if ($request->boolean('remove_receipt')) {
            $payment->removeReceipt();
        }

        if ($request->file('receipt') instanceof UploadedFile) {
            $payment->storeReceipt($request->file('receipt'));
        }
    }

    /**
     * What the form offers: the company's properties and how a payment can be made.
     *
     * @return array<string, mixed>
     */
    private function formOptions(Company $company): array
    {
        return [
            'currency' => $company->default_currency,
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code']),
            'methods' => OtherPayment::METHODS,
        ];
    }
}
