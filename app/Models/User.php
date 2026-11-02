<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\Concerns\HasPermissions;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
// The staff record holds pay and identity details, so it never travels with the shared `auth.user`;
// nor do the company and role permissions are read from, the stored permission list (`auth.permissions` is what counts) or their camps.
#[Hidden(['password', 'remember_token', 'permissions', 'staffMember', 'company', 'role', 'properties'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasPermissions, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'permissions' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<UserRole, $this>
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(UserRole::class, 'user_role_id');
    }

    /**
     * The camps an area manager or camp boss looks after (see campPropertyIds()).
     *
     * @return BelongsToMany<Property, $this>
     */
    public function properties(): BelongsToMany
    {
        return $this->belongsToMany(Property::class)->withTimestamps();
    }

    /**
     * The staff record this is the sign-in of, when the user is one of the
     * company's staff. A removed record still counts, so its sign-in never
     * becomes a full company account.
     *
     * @return HasOne<StaffMember, $this>
     */
    public function staffMember(): HasOne
    {
        return $this->hasOne(StaffMember::class)->withTrashed();
    }

    /**
     * What the user may do on the staff pages (see StaffMember::ACCESS_LEVELS).
     * Admins and company accounts that are not a staff member's sign-in have
     * full access, as they have everywhere else.
     */
    public function staffAccess(): string
    {
        return $this->is_admin || $this->staffMember === null ? 'admin' : ($this->staffMember->access ?? 'self');
    }

    /**
     * Whether the user may use the rest of the app (the dashboard, properties,
     * tenants, payments, maintenance and configuration), not only the staff
     * pages. A staff member given a role uses what the role opens.
     */
    public function canUseApp(): bool
    {
        return $this->is_admin || $this->role !== null || $this->staffMember === null || $this->staffMember->app_access;
    }
}
