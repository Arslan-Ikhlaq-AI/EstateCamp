<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * The details of a cheque that has not reached the bank yet: its date and
 * amount, number, bank, the name on it and photos of both sides.
 */
class ChequeDetailsRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'cheque';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'cheque_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'gt:0', 'max:100000000'],
            'cheque_number' => ['nullable', 'string', 'max:30'],
            'bank_name' => ['nullable', 'required_with:cheque_number', 'string', 'max:255'],
            'account_holder' => ['nullable', 'string', 'max:255'],
            'front_image' => ['nullable', 'image', 'max:8192'],
            'back_image' => ['nullable', 'image', 'max:8192'],
            'remove_front_image' => ['nullable', 'boolean'],
            'remove_back_image' => ['nullable', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Once a cheque is at the bank its details are a record of what happened.
     *
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->route('cheque')->isEditable()) {
                    $validator->errors()->add('cheque_number', 'This cheque has already been presented, so its details can no longer change.');
                }
            },
        ];
    }

    /**
     * The details as Cheque::applyEntry() takes them, with the photos.
     *
     * @return array<string, mixed>
     */
    public function entry(): array
    {
        return [
            ...$this->safe()->except(['front_image', 'back_image', 'notes']),
            'front_image' => $this->file('front_image'),
            'back_image' => $this->file('back_image'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['bank_name' => 'bank', 'front_image' => 'front photo', 'back_image' => 'back photo'];
    }
}
