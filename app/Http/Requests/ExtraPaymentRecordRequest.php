<?php

namespace App\Http\Requests;

use App\Models\Commission;
use App\Models\Deposit;
use App\Models\ExtraIncome;
use App\Models\Settlement;

/**
 * A request about one commission, deposit or extra income. The route's
 * `kind` says which; another company's or camp's record answers 404.
 */
abstract class ExtraPaymentRecordRequest extends CompanyScopedRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return parent::authorize() && $this->record()->exists;
    }

    /**
     * The record in the route.
     */
    public function record(): Commission|Deposit|ExtraIncome
    {
        return once(fn () => Settlement::KINDS[$this->route('kind')]::query()->where('company_id', $this->companyId())->findOrFail($this->route('record')));
    }
}
