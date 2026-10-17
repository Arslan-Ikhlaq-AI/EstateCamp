<?php

namespace App\Http\Requests;

use App\Models\Shop;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ShopRequest extends FormRequest
{
    /**
     * Only members of a company can save shops, and only their own. Another
     * company's shop answers 404 so its existence is not revealed.
     */
    public function authorize(): bool
    {
        $shop = $this->route('shop');

        if ($shop instanceof Shop && $shop->company_id !== $this->user()->company_id) {
            throw new NotFoundHttpException;
        }

        return $this->user()->company_id !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * The shop type is free text in the database, so any short value is accepted
     * even though the form offers the suggested types.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'property_id' => [
                'required', 'integer',
                Rule::exists('properties', 'id')
                    ->where('company_id', $this->user()->company_id)
                    ->whereNull('deleted_at'),
            ],
            'shop_number' => [
                'required', 'string', 'max:30',
                Rule::unique('shops')
                    ->where('property_id', $this->integer('property_id'))
                    ->whereNull('deleted_at')
                    ->ignore($this->route('shop')),
            ],
            'block' => ['nullable', 'string', 'max:50'],
            'floor_number' => ['nullable', 'integer', 'between:-5,200'],
            'shop_type' => ['nullable', 'string', 'max:40'],
            'area_sqm' => ['nullable', 'numeric', 'gt:0', 'max:10000'],
            'amenities' => ['array'],
            'amenities.*' => ['distinct', Rule::in(Shop::AMENITIES)],
            'monthly_rent' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'utility_account_number' => ['nullable', 'string', 'max:50'],
            'status' => ['required', Rule::in(Shop::STATUSES)],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'property_id' => 'property',
            'shop_number' => 'shop number',
            'floor_number' => 'floor',
            'shop_type' => 'shop type',
            'monthly_rent' => 'monthly rent',
            'security_deposit' => 'security deposit',
            'utility_account_number' => 'utility account number',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'shop_number.unique' => 'This property already has a shop with that number.',
        ];
    }
}
