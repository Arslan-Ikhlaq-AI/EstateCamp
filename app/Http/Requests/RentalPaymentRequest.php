<?php

namespace App\Http\Requests;

use App\Models\RentalPayment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Money a tenant pays towards their room rental: rent, the deposit or
 * another charge, in cash, by card or transfer, or by a cheque that goes
 * to the cheque register (with its number, bank, date and photos).
 */
class RentalPaymentRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'roomRental';

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $isCheque = $this->input('method') === 'cheque';

        return [
            'purpose' => ['required', Rule::in(RentalPayment::PURPOSES)],
            'method' => ['required', Rule::in(RentalPayment::METHODS)],
            'amount' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'paid_on' => [Rule::requiredIf(! $isCheque), 'nullable', 'date', 'before_or_equal:today'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'cheque_number' => [Rule::requiredIf($isCheque), 'nullable', 'string', 'max:30'],
            'bank_name' => [Rule::requiredIf($isCheque), 'nullable', 'string', 'max:255'],
            'cheque_date' => [Rule::requiredIf($isCheque), 'nullable', 'date'],
            'account_holder' => ['nullable', 'string', 'max:255'],
            'front_image' => ['nullable', 'image', 'max:8192'],
            'back_image' => ['nullable', 'image', 'max:8192'],
        ];
    }

    /**
     * The cheque as RoomRental::receiveCheque() takes it, with its photos.
     *
     * @return array<string, mixed>
     */
    public function cheque(): array
    {
        return [
            ...$this->safe()->only(['purpose', 'cheque_date', 'amount', 'cheque_number', 'bank_name', 'account_holder', 'notes']),
            'front_image' => $this->file('front_image'),
            'back_image' => $this->file('back_image'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['paid_on' => 'date paid', 'cheque_number' => 'cheque number', 'bank_name' => 'bank', 'cheque_date' => 'cheque date', 'front_image' => 'front photo', 'back_image' => 'back photo'];
    }
}
