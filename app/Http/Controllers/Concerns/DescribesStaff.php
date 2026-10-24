<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Company;
use App\Models\Property;
use App\Models\RegionalOffice;
use App\Models\StaffMember;
use App\Models\StaffRole;
use Carbon\CarbonImmutable;
use Carbon\Exceptions\InvalidFormatException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

/**
 * How the staff, attendance and payroll pages name staff and where they
 * work, the order they list them in (the head office first, then the
 * regional offices, then the camps and buildings, by role, then by name),
 * and the day or month they open on.
 */
trait DescribesStaff
{
    /**
     * Every place staff can work, as filter options: the head office, then
     * the regional offices and the properties by name. Offices and
     * properties are labelled with their names; the head office is named in
     * the browser.
     *
     * @return Collection<int, array{value: string, type: string, label: ?string, isActive: bool}>
     */
    protected function workplaceOptions(Company $company): Collection
    {
        return collect([['value' => 'head_office', 'type' => 'head_office', 'label' => null, 'isActive' => true]])
            ->concat($company->regionalOffices()->orderBy('name')->get()->map(fn (RegionalOffice $office) => [
                'value' => "office:{$office->id}",
                'type' => 'office',
                'label' => $office->name,
                'isActive' => $office->is_active,
            ]))
            ->concat($company->properties()->orderBy('name')->get(['id', 'name'])->map(fn (Property $property) => [
                'value' => "property:{$property->id}",
                'type' => 'property',
                'label' => $property->name,
                'isActive' => true,
            ]));
    }

    /**
     * The relations personDetails() reads, for eager loading. A property is
     * loaded even once removed, so former staff still say where they worked.
     *
     * @return array<string, mixed>
     */
    protected static function staffRelations(): array
    {
        return [
            'role:id,name,slug,level,sort_order',
            'regionalOffice:id,name',
            'property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code']),
        ];
    }

    /**
     * Who a staff member is and where they work, as every staff page lists them.
     *
     * @return array<string, mixed>
     */
    protected static function personDetails(StaffMember $member): array
    {
        return [
            'id' => $member->id,
            'number' => $member->employee_number,
            'name' => $member->full_name,
            'gender' => $member->gender,
            'status' => $member->status,
            'level' => $member->work_level,
            'role' => $member->role->only(['id', 'name', 'slug', 'level']),
            'workplace' => match ($member->work_level) {
                'regional' => ['type' => 'office', 'key' => $member->workplaceKey(), 'id' => $member->regional_office_id, 'name' => $member->regionalOffice?->name],
                'site' => ['type' => 'property', 'key' => $member->workplaceKey(), 'id' => $member->property_id, 'name' => $member->property?->name],
                default => ['type' => 'head_office', 'key' => 'head_office', 'id' => null, 'name' => null],
            },
        ];
    }

    /**
     * Put staff in the order every staff page lists them.
     *
     * @template TQuery of Builder<StaffMember>|HasMany<StaffMember, Company>
     *
     * @param  TQuery  $query
     * @return TQuery
     */
    protected function inStaffOrder(Builder|HasMany $query): Builder|HasMany
    {
        return $query
            ->orderByRaw("case work_level when 'head_office' then 0 when 'regional' then 1 else 2 end")
            ->orderBy(StaffRole::query()->select('sort_order')->whereColumn('staff_roles.id', 'staff_members.staff_role_id'))
            ->orderBy('full_name')
            ->orderBy('id');
    }

    /**
     * A day (`Y-m-d`) or month (`Y-m`) from the query string, or null when
     * it is missing or not a real date, so a stale link still opens.
     */
    protected function queryDate(mixed $value, string $format): ?CarbonImmutable
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            $date = CarbonImmutable::createFromFormat("!{$format}", $value);
        } catch (InvalidFormatException) {
            return null;
        }

        return $date?->format($format) === $value ? $date : null;
    }
}
