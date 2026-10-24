<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupTypeRequest;
use App\Models\MaintenanceJob;
use App\Models\MaintenanceJobUpdate;
use App\Models\MaintenanceStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;

class MaintenanceStatusController extends LookupTypeController
{
    protected function kind(): string
    {
        return 'maintenanceStatus';
    }

    protected function model(): string
    {
        return MaintenanceStatus::class;
    }

    protected function listedFields(): array
    {
        return [...parent::listedFields(), 'stage', 'color'];
    }

    protected function usageInCompany(Model $type, int $companyId): int
    {
        return $type->jobs()->where('company_id', $companyId)->count();
    }

    /**
     * A status is in use while any job is in it or its history mentions it.
     */
    protected function isInUse(Model $type): bool
    {
        return MaintenanceJob::withTrashed()->where('maintenance_status_id', $type->id)->exists()
            || MaintenanceJobUpdate::query()->where('maintenance_status_id', $type->id)->orWhere('previous_status_id', $type->id)->exists();
    }

    /**
     * Save changes to a maintenance status.
     */
    public function updateType(LookupTypeRequest $request, MaintenanceStatus $maintenanceStatus): RedirectResponse
    {
        return $this->update($request, $maintenanceStatus);
    }

    /**
     * Delete a maintenance status no job has ever been in.
     */
    public function destroyType(MaintenanceStatus $maintenanceStatus): RedirectResponse
    {
        return $this->destroy($maintenanceStatus);
    }
}
