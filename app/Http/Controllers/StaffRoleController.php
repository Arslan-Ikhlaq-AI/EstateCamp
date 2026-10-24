<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupTypeRequest;
use App\Models\StaffMember;
use App\Models\StaffRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;

class StaffRoleController extends LookupTypeController
{
    protected function kind(): string
    {
        return 'staffRole';
    }

    protected function model(): string
    {
        return StaffRole::class;
    }

    protected function listedFields(): array
    {
        return [...parent::listedFields(), 'level', 'staff_access', 'app_access'];
    }

    protected function usageInCompany(Model $type, int $companyId): int
    {
        return $type->staffMembers()->where('company_id', $companyId)->count();
    }

    protected function isInUse(Model $type): bool
    {
        return StaffMember::withTrashed()->where('staff_role_id', $type->id)->exists();
    }

    /**
     * Save changes to a staff role.
     */
    public function updateType(LookupTypeRequest $request, StaffRole $staffRole): RedirectResponse
    {
        return $this->update($request, $staffRole);
    }

    /**
     * Delete a staff role nobody holds or has held.
     */
    public function destroyType(StaffRole $staffRole): RedirectResponse
    {
        return $this->destroy($staffRole);
    }
}
