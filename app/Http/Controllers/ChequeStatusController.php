<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupTypeRequest;
use App\Models\Cheque;
use App\Models\ChequeStatus;
use App\Models\ChequeUpdate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class ChequeStatusController extends LookupTypeController
{
    protected function kind(): string
    {
        return 'chequeStatus';
    }

    protected function model(): string
    {
        return ChequeStatus::class;
    }

    protected function listedFields(): array
    {
        return [...parent::listedFields(), 'stage', 'color'];
    }

    protected function usageInCompany(Model $type, int $companyId): int
    {
        return $type->cheques()->where('company_id', $companyId)->count();
    }

    /**
     * A status is in use while any cheque is in it or its history mentions it.
     */
    protected function isInUse(Model $type): bool
    {
        return Cheque::query()->where('cheque_status_id', $type->id)->exists()
            || ChequeUpdate::query()->where('cheque_status_id', $type->id)->orWhere('previous_status_id', $type->id)->exists();
    }

    /**
     * Save changes to a cheque status.
     */
    public function updateType(LookupTypeRequest $request, ChequeStatus $chequeStatus): RedirectResponse
    {
        return $this->update($request, $chequeStatus);
    }

    /**
     * Delete a cheque status no cheque has ever been in, as long as its
     * stage keeps another one for cheques to enter it with.
     *
     * @throws ValidationException When it is the only status of its stage.
     */
    public function destroyType(ChequeStatus $chequeStatus): RedirectResponse
    {
        Gate::authorize('manage-configuration');

        if (! ChequeStatus::query()->where('stage', $chequeStatus->stage)->whereKeyNot($chequeStatus->id)->exists()) {
            throw ValidationException::withMessages([
                'type' => "{$chequeStatus->name} is the only status for its stage, so it cannot be deleted. Rename it instead.",
            ]);
        }

        return $this->destroy($chequeStatus);
    }
}
