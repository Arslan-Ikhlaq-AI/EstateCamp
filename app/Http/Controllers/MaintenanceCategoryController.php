<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupTypeRequest;
use App\Models\MaintenanceCategory;
use App\Models\MaintenanceJob;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;

class MaintenanceCategoryController extends LookupTypeController
{
    protected function kind(): string
    {
        return 'maintenanceCategory';
    }

    protected function model(): string
    {
        return MaintenanceCategory::class;
    }

    protected function usageInCompany(Model $type, int $companyId): int
    {
        return $type->jobs()->where('company_id', $companyId)->count();
    }

    protected function isInUse(Model $type): bool
    {
        return MaintenanceJob::withTrashed()->where('maintenance_category_id', $type->id)->exists();
    }

    /**
     * Save changes to a maintenance category.
     */
    public function updateType(LookupTypeRequest $request, MaintenanceCategory $maintenanceCategory): RedirectResponse
    {
        return $this->update($request, $maintenanceCategory);
    }

    /**
     * Delete a maintenance category no job uses.
     */
    public function destroyType(MaintenanceCategory $maintenanceCategory): RedirectResponse
    {
        return $this->destroy($maintenanceCategory);
    }
}
