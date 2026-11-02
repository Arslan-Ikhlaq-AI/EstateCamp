<?php

namespace App\Http\Requests\Admin;

use App\Models\Company;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The pages a platform admin switches off for a company. A few pages can
 * never be (see `always_on` in config/permissions.php).
 */
class CompanyFeaturesRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $switchable = array_diff(collect(Company::features())->flatten()->all(), config('permissions.always_on'));

        return [
            'disabled_features' => ['present', 'array'],
            'disabled_features.*' => ['string', 'distinct', Rule::in($switchable)],
        ];
    }
}
