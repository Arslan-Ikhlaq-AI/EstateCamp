<?php

namespace App\Http\Requests\Concerns;

use App\Models\Cheque;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Validation\Validator;

/**
 * The cheque schedule sent with an agreement's form: one entry per place in
 * the schedule ("rent:3"), with an adjusted date or amount, the cheque's
 * details and photos.
 *
 * Once the agreement is in force, cheques dated up to the end of its
 * current year must be in hand, so they need a number, a bank and a photo of
 * the front; later cheques can be added when they arrive. A draft can be
 * saved without them.
 */
trait ValidatesChequeSchedule
{
    /**
     * @return array<string, array<mixed>>
     */
    protected function chequeRules(): array
    {
        return [
            'cheques' => ['array', 'max:300'],
            'cheques.*.key' => ['required', 'string', 'regex:/^(rent|security_deposit):\d{1,3}$/', 'distinct'],
            'cheques.*.cheque_date' => ['nullable', 'date'],
            'cheques.*.amount' => ['nullable', 'numeric', 'gt:0', 'max:100000000'],
            'cheques.*.cheque_number' => ['nullable', 'string', 'max:30'],
            'cheques.*.bank_name' => ['nullable', 'string', 'max:255'],
            'cheques.*.account_holder' => ['nullable', 'string', 'max:255'],
            'cheques.*.front_image' => ['nullable', 'image', 'max:8192'],
            'cheques.*.back_image' => ['nullable', 'image', 'max:8192'],
            'cheques.*.remove_front_image' => ['nullable', 'boolean'],
            'cheques.*.remove_back_image' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function chequeAttributes(): array
    {
        return [
            'cheques.*.cheque_date' => 'cheque date',
            'cheques.*.amount' => 'cheque amount',
            'cheques.*.cheque_number' => 'cheque number',
            'cheques.*.bank_name' => 'bank',
            'cheques.*.front_image' => 'front photo',
            'cheques.*.back_image' => 'back photo',
        ];
    }

    /**
     * The submitted cheques keyed by place in the schedule, with their photos.
     *
     * @return array<string, array<string, mixed>>
     */
    public function chequeEntries(): array
    {
        $entries = [];

        foreach ($this->validated('cheques', []) as $index => $entry) {
            $entries[$entry['key']] = [
                ...Arr::only($entry, ['cheque_date', 'amount', 'cheque_number', 'bank_name', 'account_holder', 'remove_front_image', 'remove_back_image']),
                'front_image' => $this->file("cheques.{$index}.front_image"),
                'back_image' => $this->file("cheques.{$index}.back_image"),
            ];
        }

        return $entries;
    }

    /**
     * Check that every submitted cheque due by the end of the agreement's
     * current year has its number, bank and front photo. `$planned` is the
     * agreement as the form would leave it (unsaved), which gives the year;
     * `$saved` is the stored agreement, if any, whose cheques may already
     * have a photo or have reached the bank (and so are left alone).
     */
    protected function checkChequesDueNow(Validator $validator, Model $planned, ?Model $saved): void
    {
        /** @var Collection<string, Cheque> $existing */
        $existing = $saved ? $saved->cheques()->whereNull('replaces_id')->get()->keyBy(fn (Cheque $cheque) => $cheque->scheduleKey()) : collect();
        [, $yearEnd] = Cheque::currentYear($planned->start_date, $planned->end_date);
        $plannedDates = collect($planned->plannedCheques())->mapWithKeys(fn (array $row) => [Cheque::key($row['purpose'], $row['sequence']) => $row['cheque_date']]);

        foreach ($this->input('cheques', []) as $index => $entry) {
            if (! is_array($entry) || ! isset($entry['key'])) {
                continue;
            }

            $cheque = $existing->get($entry['key']);
            $date = $entry['cheque_date'] ?? $cheque?->cheque_date?->toDateString() ?? $plannedDates->get($entry['key']);

            if (($cheque && ! $cheque->isEditable()) || blank($date) || CarbonImmutable::parse($date)->gt($yearEnd)) {
                continue;
            }

            $value = fn (string $field) => array_key_exists($field, $entry) ? $entry[$field] : $cheque?->{$field};
            $hasFront = $this->file("cheques.{$index}.front_image") instanceof UploadedFile
                || ($cheque?->front_image_path && empty($entry['remove_front_image']));

            if (blank($value('cheque_number'))) {
                $validator->errors()->add("cheques.{$index}.cheque_number", 'Enter the cheque number. Cheques for this year are needed now.');
            }

            if (blank($value('bank_name'))) {
                $validator->errors()->add("cheques.{$index}.bank_name", 'Enter the bank.');
            }

            if (! $hasFront) {
                $validator->errors()->add("cheques.{$index}.front_image", 'Add a photo of the front of the cheque.');
            }
        }
    }
}
