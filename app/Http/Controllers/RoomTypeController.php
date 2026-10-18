<?php

namespace App\Http\Controllers;

use App\Http\Requests\LookupTypeRequest;
use App\Models\Room;
use App\Models\RoomType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\RedirectResponse;

class RoomTypeController extends LookupTypeController
{
    protected function kind(): string
    {
        return 'room';
    }

    protected function model(): string
    {
        return RoomType::class;
    }

    protected function usageInCompany(Model $type, int $companyId): int
    {
        return $type->rooms()->where('company_id', $companyId)->count();
    }

    protected function isInUse(Model $type): bool
    {
        return Room::withTrashed()->where('room_type_id', $type->id)->exists();
    }

    /**
     * Save changes to a room type.
     */
    public function updateType(LookupTypeRequest $request, RoomType $roomType): RedirectResponse
    {
        return $this->update($request, $roomType);
    }

    /**
     * Delete a room type no room uses.
     */
    public function destroyType(RoomType $roomType): RedirectResponse
    {
        return $this->destroy($roomType);
    }
}
