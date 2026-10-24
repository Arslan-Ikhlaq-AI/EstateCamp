<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\DescribesStaff;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Requests\StaffMemberRequest;
use App\Models\Company;
use App\Models\SalaryPayment;
use App\Models\StaffAttendance;
use App\Models\StaffMember;
use App\Models\StaffRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Staff: everyone the company employs, from the head office through its
 * regional offices to its camps and buildings, with their role, identity
 * documents and salary.
 */
class StaffMemberController extends Controller
{
    use DescribesStaff, ListsRecords;

    /**
     * List the staff: those still employed first, in the company's order.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Staff/Index', ['company' => null]);
        }

        $roles = StaffRole::query()->orderBy('sort_order')->orderBy('name')->get();
        $workplaces = $this->workplaceOptions($company);
        $filters = $this->listFilters($request, [
            'status' => StaffMember::STATUSES,
            'level' => StaffRole::LEVELS,
            'roles' => $roles->pluck('slug')->all(),
            'workplace' => $workplaces->pluck('value')->all(),
            'documents' => ['expired', 'expiring'],
        ]);
        $query = fn (?string $except = null) => $this->filteredQuery($company, $filters, $roles, $except);
        $roleCounts = $this->countBy($query('roles'), 'staff_role_id');
        $workplaceCounts = $this->workplaceCounts($query('workplace'));

        return Inertia::render('Staff/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'facets' => [
                'status' => $this->facetOptions(StaffMember::STATUSES, $this->countBy($query('status'), 'status')),
                'level' => $this->facetOptions(StaffRole::LEVELS, $this->countBy($query('level'), 'work_level')),
                'roles' => $roles
                    ->filter(fn (StaffRole $role) => $role->is_active || $roleCounts->get($role->id, 0) > 0)
                    ->map(fn (StaffRole $role) => ['value' => $role->slug, 'label' => $role->name, 'level' => $role->level, 'count' => $roleCounts->get($role->id, 0)])
                    ->values(),
                'workplace' => $workplaces
                    ->filter(fn (array $workplace) => $workplace['isActive'] || $workplaceCounts->get($workplace['value'], 0) > 0)
                    ->map(fn (array $workplace) => [...$workplace, 'count' => $workplaceCounts->get($workplace['value'], 0)])
                    ->values(),
                'documents' => [
                    ['value' => 'expired', 'count' => $query('documents')->current()->documentsExpiring(null, today()->subDay())->count()],
                    ['value' => 'expiring', 'count' => $query('documents')->current()->documentsExpiring(today(), today()->addDays(StaffMember::DOCUMENT_WARNING_DAYS))->count()],
                ],
            ],
            'summary' => $this->summary($company),
            'canManage' => Gate::allows('manage-staff'),
            'staff' => $this->inStaffOrder($query()->orderByRaw("case status when 'active' then 0 when 'on_leave' then 1 else 2 end"))
                ->with(self::staffRelations())
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (StaffMember $member) => self::summaryDetails($member)),
        ]);
    }

    /**
     * Show the form for adding a staff member, placed at a property or office when given.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $property = $company->properties()->find($request->integer('property'));
        $office = $company->regionalOffices()->find($request->integer('office'));

        return Inertia::render('Staff/Form', [
            'staff' => null,
            'defaults' => [
                'work_level' => $property ? 'site' : ($office ? 'regional' : null),
                'property_id' => $property?->id,
                'regional_office_id' => $office?->id,
            ],
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Add a staff member with the next employee number for the year they
     * joined, and their sign-in when they are given one.
     */
    public function store(StaffMemberRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);

        $member = new StaffMember($request->details());
        $member->placeAt($request->validated('work_level'), $request->integer('regional_office_id') ?: null, $request->integer('property_id') ?: null);
        $member->forceFill([
            'company_id' => $company->id,
            'employee_number' => StaffMember::nextNumber($company->id, $request->date('joined_on')),
            'created_by' => $request->user()->id,
        ]);

        DB::transaction(function () use ($member, $request) {
            $member->save();
            $member->syncSignIn(...$request->signIn());
        });

        return to_route('staff.show', $member)->with('success', "{$member->full_name} was added to your staff as {$member->employee_number}.");
    }

    /**
     * Show a staff member with their documents, salary, this month's attendance and their salary history.
     */
    public function show(Request $request, StaffMember $staffMember): Response
    {
        $this->ensureSameCompany($request, $staffMember);

        $staffMember->load([...self::staffRelations(), 'createdBy:id,name', 'user:id,email']);

        // The current month, or the last month they worked if they have left.
        $monthStart = CarbonImmutable::today()->startOfMonth();

        if ($staffMember->left_on?->lt($monthStart)) {
            $monthStart = CarbonImmutable::parse($staffMember->left_on)->startOfMonth();
        }

        $attendance = $staffMember->attendances()
            ->whereDate('work_date', '>=', $monthStart)
            ->whereDate('work_date', '<=', $monthStart->endOfMonth())
            ->orderBy('work_date')
            ->get();

        return Inertia::render('Staff/Show', [
            'currency' => $staffMember->company->default_currency,
            'staff' => [
                ...self::summaryDetails($staffMember),
                'email' => $staffMember->email,
                'dateOfBirth' => $staffMember->date_of_birth?->toDateString(),
                'documents' => $staffMember->identityDocuments(),
                'salary' => self::salaryStructure($staffMember),
                'emergencyContact' => ['name' => $staffMember->emergency_contact_name, 'phone' => $staffMember->emergency_contact_phone],
                'notes' => $staffMember->notes,
                'createdBy' => $staffMember->createdBy?->name,
                'signIn' => $staffMember->user ? [
                    'email' => $staffMember->user->email,
                    'access' => $staffMember->access,
                    'appAccess' => $staffMember->app_access,
                    'hasEnded' => $staffMember->signInHasEnded(),
                ] : null,
            ],
            'canManage' => Gate::allows('manage-staff'),
            'attendance' => [
                'month' => $monthStart->format('Y-m'),
                'days' => $monthStart->daysInMonth,
                'marks' => $attendance->map(fn (StaffAttendance $mark) => [
                    'day' => $mark->work_date->day,
                    'status' => $mark->status,
                    'checkIn' => StaffAttendance::shortTime($mark->check_in),
                    'checkOut' => StaffAttendance::shortTime($mark->check_out),
                    'note' => $mark->note,
                ]),
                'counts' => collect(StaffAttendance::STATUSES)->mapWithKeys(fn (string $status) => [$status => $attendance->where('status', $status)->count()]),
            ],
            'salaries' => $staffMember->salaryPayments()
                ->orderByDesc('period')
                ->limit(12)
                ->get()
                ->map(fn (SalaryPayment $salary) => PayrollController::salaryDetails($salary)),
        ]);
    }

    /**
     * Show the form for editing a staff member.
     */
    public function edit(Request $request, StaffMember $staffMember): Response
    {
        $this->ensureSameCompany($request, $staffMember);

        $dates = ['date_of_birth', 'joined_on', 'left_on', 'emirates_id_expiry', 'passport_expiry', 'visa_expiry'];
        $amounts = ['basic_salary', 'housing_allowance', 'transport_allowance', 'other_allowance'];

        return Inertia::render('Staff/Form', [
            'staff' => [
                'id' => $staffMember->id,
                'number' => $staffMember->employee_number,
                ...$staffMember->only([
                    'full_name', 'gender', 'nationality', 'phone', 'email', 'work_level', 'staff_role_id', 'regional_office_id', 'property_id',
                    'employment_type', 'status', 'emirates_id_number', 'passport_number', 'visa_number', 'salary_payment_method', 'bank_name', 'iban',
                    'emergency_contact_name', 'emergency_contact_phone', 'notes',
                ]),
                ...collect($dates)->mapWithKeys(fn (string $field) => [$field => $staffMember->{$field}?->toDateString()]),
                ...collect($amounts)->mapWithKeys(fn (string $field) => [$field => (float) $staffMember->{$field}]),
                // Without a sign-in yet, its access starts from the role's.
                'has_sign_in' => $staffMember->user_id !== null,
                'can_sign_in' => $staffMember->user_id !== null,
                'access' => $staffMember->user_id ? $staffMember->access : $staffMember->role->staff_access,
                'app_access' => $staffMember->user_id ? $staffMember->app_access : $staffMember->role->app_access,
            ],
            'defaults' => null,
            ...$this->formOptions($staffMember->company, $staffMember),
        ]);
    }

    /**
     * Save changes to a staff member and their sign-in; their employee number stays as it was.
     */
    public function update(StaffMemberRequest $request, StaffMember $staffMember): RedirectResponse
    {
        $staffMember->fill($request->details());
        $staffMember->placeAt($request->validated('work_level'), $request->integer('regional_office_id') ?: null, $request->integer('property_id') ?: null);

        DB::transaction(function () use ($staffMember, $request) {
            $staffMember->save();
            $staffMember->syncSignIn(...$request->signIn());
        });

        return to_route('staff.show', $staffMember)->with('success', "{$staffMember->full_name} was updated.");
    }

    /**
     * One staff member as the list and their page show them.
     *
     * @return array<string, mixed>
     */
    public static function summaryDetails(StaffMember $member): array
    {
        return [
            ...self::personDetails($member),
            'nationality' => $member->nationality,
            'phone' => $member->phone,
            'employmentType' => $member->employment_type,
            'joinedOn' => $member->joined_on->toDateString(),
            'leftOn' => $member->left_on?->toDateString(),
            'grossSalary' => $member->grossSalary(),
            'documentAlert' => $member->documentAlert(),
            'hasSignIn' => $member->user_id !== null,
        ];
    }

    /**
     * A staff member's monthly salary, its parts, and how it is paid.
     *
     * @return array<string, mixed>
     */
    public static function salaryStructure(StaffMember $member): array
    {
        return [
            'basic' => (float) $member->basic_salary,
            'housing' => (float) $member->housing_allowance,
            'transport' => (float) $member->transport_allowance,
            'other' => (float) $member->other_allowance,
            'gross' => $member->grossSalary(),
            'method' => $member->salary_payment_method,
            'bankName' => $member->bank_name,
            'iban' => $member->iban,
        ];
    }

    /**
     * Headline figures: who is employed, what their salaries come to each
     * month, today's attendance, and documents to renew.
     *
     * @return array<string, mixed>
     */
    private function summary(Company $company): array
    {
        $current = fn () => $company->staffMembers()->current();
        $today = today();
        $marked = $this->countBy(
            $company->staffAttendances()->whereDate('work_date', $today)->whereIn('staff_member_id', $current()->employedOn($today)->select('id')),
            'status',
        );

        return [
            'active' => $company->staffMembers()->where('status', 'active')->count(),
            'onLeave' => $company->staffMembers()->where('status', 'on_leave')->count(),
            'left' => $company->staffMembers()->whereIn('status', StaffMember::LEFT_STATUSES)->count(),
            'monthlySalaries' => round((float) $current()->sum(DB::raw('basic_salary + housing_allowance + transport_allowance + other_allowance')), 2),
            'today' => [
                'employed' => $current()->employedOn($today)->count(),
                'marked' => $marked->sum(),
                'present' => $marked->get('present', 0) + $marked->get('half_day', 0),
                'absent' => $marked->get('absent', 0),
            ],
            'documents' => [
                'expired' => $current()->documentsExpiring(null, $today->copy()->subDay())->count(),
                'expiring' => $current()->documentsExpiring($today, $today->copy()->addDays(StaffMember::DOCUMENT_WARNING_DAYS))->count(),
            ],
        ];
    }

    /**
     * The company's staff narrowed by the search and filters, leaving out the
     * filter named in `$except`. Role filters hold slugs, matched to ids
     * through `$roles`.
     *
     * @param  array<string, mixed>  $filters
     * @param  Collection<int, StaffRole>  $roles
     * @return HasMany<StaffMember, Company>
     */
    private function filteredQuery(Company $company, array $filters, Collection $roles, ?string $except = null): HasMany
    {
        $search = $filters['search'];

        return $company->staffMembers()
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('full_name', "%{$search}%")
                ->orWhereLike('employee_number', "%{$search}%")
                ->orWhereLike('phone', "%{$search}%")
                ->orWhereLike('nationality', "%{$search}%")
                ->orWhereLike('emirates_id_number', "%{$search}%")
                ->orWhereLike('passport_number', "%{$search}%")))
            ->when($except !== 'status' && $filters['status'] !== [], fn (Builder $query) => $query->whereIn('status', $filters['status']))
            ->when($except !== 'level' && $filters['level'] !== [], fn (Builder $query) => $query->whereIn('work_level', $filters['level']))
            ->when($except !== 'roles' && $filters['roles'] !== [], fn (Builder $query) => $query->whereIn('staff_role_id', $roles->whereIn('slug', $filters['roles'])->modelKeys()))
            ->when($except !== 'workplace' && $filters['workplace'] !== [], fn (Builder $query) => $query->where(function (Builder $query) use ($filters) {
                foreach ($filters['workplace'] as $workplace) {
                    $query->orWhere(fn (Builder $query) => $query->atWorkplace($workplace));
                }
            }))
            ->when($except !== 'documents' && $filters['documents'] !== [], fn (Builder $query) => $query->current()->where(fn (Builder $query) => $query
                ->when(in_array('expired', $filters['documents'], true), fn (Builder $query) => $query->orWhere(fn (Builder $query) => $query->documentsExpiring(null, today()->subDay())))
                ->when(in_array('expiring', $filters['documents'], true), fn (Builder $query) => $query->orWhere(fn (Builder $query) => $query->documentsExpiring(today(), today()->addDays(StaffMember::DOCUMENT_WARNING_DAYS))))));
    }

    /**
     * How many staff in `$query` work at each workplace, keyed as workplaceOptions() names them.
     *
     * @param  HasMany<StaffMember, Company>  $query
     * @return \Illuminate\Support\Collection<string, int>
     */
    private function workplaceCounts(HasMany $query): \Illuminate\Support\Collection
    {
        return $query->toBase()
            ->groupBy('work_level', 'regional_office_id', 'property_id')
            ->selectRaw('work_level, regional_office_id, property_id, count(*) as aggregate')
            ->get()
            ->mapWithKeys(fn (object $row) => [
                match ($row->work_level) {
                    'regional' => "office:{$row->regional_office_id}",
                    'site' => "property:{$row->property_id}",
                    default => 'head_office',
                } => (int) $row->aggregate,
            ]);
    }

    /**
     * The roles, offices and properties the form offers, and its fixed
     * lists. A switched-off role or office stays offered to the staff
     * member already using it.
     *
     * @return array<string, mixed>
     */
    private function formOptions(Company $company, ?StaffMember $member = null): array
    {
        $activeOr = fn (?int $currentId) => fn (Builder $query) => $query->where('is_active', true)->when($currentId, fn (Builder $query) => $query->orWhere('id', $currentId));

        return [
            'currency' => $company->default_currency,
            'roles' => StaffRole::query()
                ->where($activeOr($member?->staff_role_id))
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'level', 'description', 'staff_access', 'app_access']),
            'offices' => $company->regionalOffices()
                ->where($activeOr($member?->regional_office_id))
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'city']),
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code']),
            'levels' => StaffRole::LEVELS,
            'genders' => StaffMember::GENDERS,
            'employmentTypes' => StaffMember::EMPLOYMENT_TYPES,
            'statuses' => StaffMember::STATUSES,
            'paymentMethods' => StaffMember::PAYMENT_METHODS,
            'accessLevels' => StaffMember::ACCESS_LEVELS,
        ];
    }
}
