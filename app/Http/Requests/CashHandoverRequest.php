<?php

namespace App\Http\Requests;

use App\Models\MaintenanceJob;
use App\Models\OtherPayment;
use App\Models\Property;
use App\Models\RentalPayment;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * An admin settling the cash the camp boss handles at a property: the cash
 * collected (`receipts`) less the maintenance bills (`bills`) and one-off
 * payments (`others`) paid out of it, as on screen, so nothing taken or
 * spent since the page was opened is settled unseen.
 */
class CashHandoverRequest extends CompanyScopedRequest
{
    protected ?string $recordParameter = 'property';

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return parent::authorize() && Gate::allows('confirm-cash-handover');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'receipts' => ['required_without_all:bills,others', 'array'],
            'receipts.*' => ['integer', 'distinct'],
            'bills' => ['array'],
            'bills.*' => ['integer', 'distinct'],
            'others' => ['array'],
            'others.*' => ['integer', 'distinct'],
        ];
    }

    /**
     * The cash receipts asked for that are from short-term rentals at
     * `$property` and still with the camp boss. Others are left out.
     *
     * @return Collection<int, RentalPayment>
     */
    public function receipts(Property $property): Collection
    {
        return RentalPayment::query()
            ->whereKey($this->validated('receipts', []))
            ->where('company_id', $property->company_id)
            ->whereHas('rental', fn (Builder $rental) => $rental->where('property_id', $property->id))
            ->where('method', 'cash')
            ->where('status', 'cleared')
            ->whereNull('handed_over_at')
            ->lockForUpdate()
            ->get();
    }

    /**
     * The maintenance bills asked for at `$property` paid in cash and not
     * yet settled. Others are left out.
     *
     * @return Collection<int, MaintenanceJob>
     */
    public function bills(Property $property): Collection
    {
        return MaintenanceJob::query()
            ->whereKey($this->validated('bills', []))
            ->where('company_id', $property->company_id)
            ->where('property_id', $property->id)
            ->where('amount', '>', 0)
            ->where('payment_method', 'cash')
            ->whereNotNull('paid_on')
            ->whereNull('handed_over_at')
            ->lockForUpdate()
            ->get();
    }

    /**
     * The one-off payments asked for at `$property` paid in cash and not
     * yet settled. Others are left out.
     *
     * @return Collection<int, OtherPayment>
     */
    public function others(Property $property): Collection
    {
        return OtherPayment::query()
            ->whereKey($this->validated('others', []))
            ->where('company_id', $property->company_id)
            ->where('property_id', $property->id)
            ->where('status', 'paid')
            ->where('method', 'cash')
            ->whereNull('handed_over_at')
            ->lockForUpdate()
            ->get();
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['receipts.required_without_all' => 'Choose the cash to confirm.'];
    }
}
