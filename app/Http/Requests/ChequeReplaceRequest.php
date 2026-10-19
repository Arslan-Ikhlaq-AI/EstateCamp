<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

/**
 * A new cheque standing in for a bounced one: it is in hand now, so it needs
 * its number, bank and a photo of the front.
 */
class ChequeReplaceRequest extends CompanyScopedRequest
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
            'cheque_number' => ['required', 'string', 'max:30'],
            'bank_name' => ['required', 'string', 'max:255'],
            'account_holder' => ['nullable', 'string', 'max:255'],
            'front_image' => ['required', 'image', 'max:8192'],
            'back_image' => ['nullable', 'image', 'max:8192'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->route('cheque')->canBeReplaced()) {
                    $validator->errors()->add('cheque_number', 'Only a bounced cheque that has not been replaced yet can be replaced.');
                }
            },
        ];
    }

    /**
     * The new cheque as Cheque::applyEntry() takes it, with the photos.
     *
     * @return array<string, mixed>
     */
    public function entry(): array
    {
        return [
            ...$this->safe()->except(['front_image', 'back_image']),
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
