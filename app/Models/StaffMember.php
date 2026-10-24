<?php

namespace App\Models;

use App\Models\Concerns\HasDocumentNumber;
use Carbon\CarbonInterface;
use Database\Factories\StaffMemberFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * One person the company employs: who they are, the role they hold and
 * where they work (the head office, one of its regional offices, or a camp
 * or building), their Emirates ID, passport and visa with the dates they
 * expire, and their monthly salary (basic pay plus allowances).
 *
 * Someone who resigned or was let go keeps their record, with the day they
 * left, so their attendance and salary history stay in place.
 *
 * A staff member can be given a sign-in: a user account of the company,
 * with what it may do (`access`, and `app_access` for the rest of the app).
 * It stops working once they have left.
 */
#[Fillable([
    'full_name',
    'gender',
    'nationality',
    'date_of_birth',
    'phone',
    'email',
    'staff_role_id',
    'employment_type',
    'joined_on',
    'status',
    'left_on',
    'emirates_id_number',
    'emirates_id_expiry',
    'passport_number',
    'passport_expiry',
    'visa_number',
    'visa_expiry',
    'basic_salary',
    'housing_allowance',
    'transport_allowance',
    'other_allowance',
    'salary_payment_method',
    'bank_name',
    'iban',
    'emergency_contact_name',
    'emergency_contact_phone',
    'notes',
])]
class StaffMember extends Model
{
    /** @use HasFactory<StaffMemberFactory> */
    use HasDocumentNumber, HasFactory, SoftDeletes;

    public const NUMBER_PREFIX = 'EMP';

    public const NUMBER_COLUMN = 'employee_number';

    public const GENDERS = ['male', 'female'];

    public const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'temporary'];

    public const STATUSES = ['active', 'on_leave', 'resigned', 'terminated'];

    /**
     * Statuses of someone who no longer works for the company; they need the day they left.
     */
    public const LEFT_STATUSES = ['resigned', 'terminated'];

    public const PAYMENT_METHODS = ['bank_transfer', 'cash', 'cheque'];

    /**
     * The identity documents kept on the record, each with a
     * `{document}_number` and a `{document}_expiry` column.
     */
    public const DOCUMENTS = ['emirates_id', 'passport', 'visa'];

    /**
     * A document expiring within this many days needs renewing.
     */
    public const DOCUMENT_WARNING_DAYS = 60;

    /**
     * What a sign-in may do on the staff pages: `self` marks and sees its own
     * attendance and pay; `supervisor` also sees every staff member, marks
     * their attendance and sees their salaries; `admin` also adds and edits
     * staff and prepares and pays the payroll.
     */
    public const ACCESS_LEVELS = ['self', 'supervisor', 'admin'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'joined_on' => 'date',
            'left_on' => 'date',
            'emirates_id_expiry' => 'date',
            'passport_expiry' => 'date',
            'visa_expiry' => 'date',
            'basic_salary' => 'decimal:2',
            'housing_allowance' => 'decimal:2',
            'transport_allowance' => 'decimal:2',
            'other_allowance' => 'decimal:2',
            'app_access' => 'boolean',
        ];
    }

    /**
     * Place the staff member at the head office, a regional office or a
     * property (camp or building).
     */
    public function placeAt(string $level, ?int $regionalOfficeId = null, ?int $propertyId = null): void
    {
        $this->forceFill([
            'work_level' => $level,
            'regional_office_id' => $level === 'regional' ? $regionalOfficeId : null,
            'property_id' => $level === 'site' ? $propertyId : null,
        ]);
    }

    /**
     * Where they work, as the staff list and attendance filters name it:
     * `head_office`, `office:{id}` or `property:{id}`.
     */
    public function workplaceKey(): string
    {
        return match ($this->work_level) {
            'regional' => "office:{$this->regional_office_id}",
            'site' => "property:{$this->property_id}",
            default => 'head_office',
        };
    }

    /**
     * Housing, transport and other allowances together, per month.
     */
    public function allowances(): float
    {
        return round((float) $this->housing_allowance + (float) $this->transport_allowance + (float) $this->other_allowance, 2);
    }

    /**
     * Basic pay plus allowances, per month.
     */
    public function grossSalary(): float
    {
        return round((float) $this->basic_salary + $this->allowances(), 2);
    }

    public function hasLeft(): bool
    {
        return in_array($this->status, self::LEFT_STATUSES, true);
    }

    /**
     * Whether they work for the company on `$day`: they had joined and had not yet left.
     */
    public function isEmployedOn(CarbonInterface $day): bool
    {
        $date = $day->toDateString();

        return $this->joined_on->toDateString() <= $date && ($this->left_on === null || $this->left_on->toDateString() >= $date);
    }

    /**
     * The shift they checked into on `$today` or the day before (a night
     * shift ends the next morning) and have not checked out of yet.
     */
    public function openShift(CarbonInterface $today): ?StaffAttendance
    {
        return $this->attendances()
            ->whereDate('work_date', '>=', $today->copy()->subDay()->toDateString())
            ->whereDate('work_date', '<=', $today->toDateString())
            ->where('status', 'present')
            ->whereNotNull('check_in')
            ->whereNull('check_out')
            ->orderByDesc('work_date')
            ->first();
    }

    /**
     * Whether their sign-in has stopped working: they left before today, or
     * their record was removed.
     */
    public function signInHasEnded(): bool
    {
        return $this->trashed() || ($this->left_on !== null && $this->left_on->lt(today()));
    }

    /**
     * Give the staff member a sign-in with `$access` (and the rest of the
     * app when `$appAccess`), logging in with their email, or update the one
     * they have; a new password is set only when given. Without `$canSignIn`
     * their sign-in is removed. Their account carries their name and email.
     */
    public function syncSignIn(bool $canSignIn, ?string $access = null, bool $appAccess = false, ?string $password = null): void
    {
        DB::transaction(function () use ($canSignIn, $access, $appAccess, $password) {
            if (! $canSignIn) {
                $this->user?->delete();
                $this->forceFill(['user_id' => null, 'access' => null, 'app_access' => false])->save();
                $this->setRelation('user', null);

                return;
            }

            $user = $this->user ?? new User;
            $user->forceFill([
                'name' => $this->full_name,
                'email' => $this->email,
                'company_id' => $this->company_id,
                'is_admin' => false,
                // The company vouches for the address, so the account is ready to use.
                'email_verified_at' => $user->email_verified_at ?? now(),
            ]);

            if (filled($password)) {
                $user->password = $password;
            }

            $user->save();
            $this->forceFill(['user_id' => $user->id, 'access' => $access, 'app_access' => $appAccess])->save();
            $this->setRelation('user', $user);
        });
    }

    /**
     * Each identity document with its number, the day it expires and the
     * days left until then (negative once expired).
     *
     * @return list<array{type: string, number: ?string, expiresOn: ?string, days: ?int}>
     */
    public function identityDocuments(): array
    {
        return array_map(function (string $type): array {
            $expiry = $this->{"{$type}_expiry"};

            return [
                'type' => $type,
                'number' => $this->{"{$type}_number"},
                'expiresOn' => $expiry?->toDateString(),
                'days' => $expiry ? (int) today()->diffInDays($expiry, false) : null,
            ];
        }, self::DOCUMENTS);
    }

    /**
     * `expired` when a document has run out, `expiring` when one runs out
     * within the warning window, otherwise null. Only staff still employed
     * need their documents renewed.
     */
    public function documentAlert(): ?string
    {
        if ($this->hasLeft()) {
            return null;
        }

        $days = collect($this->identityDocuments())->pluck('days')->filter(fn (?int $days) => $days !== null);

        return match (true) {
            $days->contains(fn (int $days) => $days < 0) => 'expired',
            $days->contains(fn (int $days) => $days <= self::DOCUMENT_WARNING_DAYS) => 'expiring',
            default => null,
        };
    }

    /**
     * Staff who work for the company on `$day`: they had joined and had not yet left.
     *
     * @param  Builder<StaffMember>  $query
     */
    #[Scope]
    protected function employedOn(Builder $query, CarbonInterface $day): void
    {
        $this->employedBetween($query, $day, $day);
    }

    /**
     * Staff who worked for the company on any day from `$from` to `$to`.
     *
     * @param  Builder<StaffMember>  $query
     */
    #[Scope]
    protected function employedBetween(Builder $query, CarbonInterface $from, CarbonInterface $to): void
    {
        $query->whereDate('joined_on', '<=', $to)
            ->where(fn (Builder $query) => $query->whereNull('left_on')->orWhereDate('left_on', '>=', $from));
    }

    /**
     * Staff still employed, working or on leave.
     *
     * @param  Builder<StaffMember>  $query
     */
    #[Scope]
    protected function current(Builder $query): void
    {
        $query->whereNotIn('staff_members.status', self::LEFT_STATUSES);
    }

    /**
     * Staff at one workplace, named as workplaceKey() names it.
     *
     * @param  Builder<StaffMember>  $query
     */
    #[Scope]
    protected function atWorkplace(Builder $query, string $workplace): void
    {
        [$kind, $id] = array_pad(explode(':', $workplace, 2), 2, null);

        match ($kind) {
            'office' => $query->where('work_level', 'regional')->where('regional_office_id', (int) $id),
            'property' => $query->where('work_level', 'site')->where('property_id', (int) $id),
            default => $query->where('work_level', 'head_office'),
        };
    }

    /**
     * Staff with an identity document that expires between `$from` and
     * `$to`, or at any time up to `$to` when `$from` is null.
     *
     * @param  Builder<StaffMember>  $query
     */
    #[Scope]
    protected function documentsExpiring(Builder $query, ?CarbonInterface $from, CarbonInterface $to): void
    {
        $query->where(function (Builder $query) use ($from, $to) {
            foreach (self::DOCUMENTS as $type) {
                $query->orWhere(fn (Builder $query) => $query
                    ->whereDate("{$type}_expiry", '<=', $to)
                    ->when($from, fn (Builder $query) => $query->whereDate("{$type}_expiry", '>=', $from)));
            }
        });
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<StaffRole, $this>
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(StaffRole::class, 'staff_role_id');
    }

    /**
     * @return BelongsTo<RegionalOffice, $this>
     */
    public function regionalOffice(): BelongsTo
    {
        return $this->belongsTo(RegionalOffice::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return HasMany<StaffAttendance, $this>
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(StaffAttendance::class);
    }

    /**
     * @return HasMany<SalaryPayment, $this>
     */
    public function salaryPayments(): HasMany
    {
        return $this->hasMany(SalaryPayment::class);
    }

    /**
     * The account they sign in with, if they have one.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
