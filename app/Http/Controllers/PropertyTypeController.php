<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupTypeRequest;
use App\Models\Property;
use App\Models\PropertyType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;

class PropertyTypeController extends LookupTypeController
{
    protected function kind(): string
    {
        return 'property';
    }

    protected function model(): string
    {
        return PropertyType::class;
    }

    protected function usageInCompany(Model $type, int $companyId): int
    {
        return $type->properties()->where('company_id', $companyId)->count();
    }

    protected function isInUse(Model $type): bool
    {
        return Property::withTrashed()->where('property_type_id', $type->id)->exists();
    }

    /**
     * Save changes to a property type.
     */
    public function updateType(LookupTypeRequest $request, PropertyType $propertyType): RedirectResponse
    {
        return $this->update($request, $propertyType);
    }

    /**
     * Delete a property type no property uses.
     */
    public function destroyType(PropertyType $propertyType): RedirectResponse
    {
        return $this->destroy($propertyType);
    }
}
