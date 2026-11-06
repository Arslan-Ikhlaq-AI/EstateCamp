<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A commission or deposit that will not be paid is cancelled, or counted
 * again.
 */
class ExtraPaymentStatusRequest extends ExtraPaymentRecordRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['cancelled' => ['required', 'boolean']];
    }
}
