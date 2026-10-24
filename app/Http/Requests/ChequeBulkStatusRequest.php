<?php

namespace App\Http\Requests;

use App\Models\Cheque;
use App\Models\ChequeStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\Rule;

/**
 * Several of the company's cheques chosen on the register, all moving to
 * one status on the same day. Cheques that cannot take that move are left
 * as they are.
 */
class ChequeBulkStatusRequest extends CompanyScopedRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'cheque_ids' => ['required', 'array', 'min:1', 'max:100'],
            'cheque_ids.*' => ['integer', 'distinct', $this->existsInCompany('cheques', softDeletes: false)],
            'cheque_status_id' => ['required', 'integer', Rule::exists('cheque_statuses', 'id')->where('is_active', true)],
            'date' => ['required', 'date', 'before_or_equal:today'],
            'reason' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function newStatus(): ChequeStatus
    {
        return ChequeStatus::query()->findOrFail($this->validated('cheque_status_id'));
    }

    /**
     * The chosen cheques, oldest dated first.
     *
     * @return Collection<int, Cheque>
     */
    public function cheques(): Collection
    {
        return Cheque::query()
            ->where('company_id', $this->companyId())
            ->whereKey($this->validated('cheque_ids'))
            ->with(['chequeStatus', 'chequeable'])
            ->orderBy('cheque_date')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['cheque_ids' => 'cheques', 'cheque_status_id' => 'status'];
    }
}
