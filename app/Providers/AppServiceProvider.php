<?php

namespace App\Providers;

use App\Models\Commission;
use App\Models\Contract;
use App\Models\Deposit;
use App\Models\ExtraIncome;
use App\Models\HeadLease;
use App\Models\MaintenanceContract;
use App\Models\RoomRental;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Short, stable names for the agreements cheques belong to, so stored rows do not depend on class names.
        Relation::morphMap([
            'commission' => Commission::class,
            'contract' => Contract::class,
            'deposit' => Deposit::class,
            'extra_income' => ExtraIncome::class,
            'head_lease' => HeadLease::class,
            'maintenance_contract' => MaintenanceContract::class,
            'room_rental' => RoomRental::class,
        ]);

        Vite::prefetch(concurrency: 3);

        // Signing up checks each field as it is filled in, but a company (and its emails) can be created only a few times an hour.
        RateLimiter::for('onboarding', fn (Request $request) => $request->isAttemptingPrecognition()
            ? Limit::perMinute(120)->by($request->ip())
            : Limit::perHour(10)->by($request->ip()));

        // Every permission in config/permissions.php is an ability of its own, so `can('rooms.create')` works anywhere.
        Gate::before(fn (User $user, string $ability): ?bool => in_array($ability, User::allPermissions(), true) ? $user->hasPermission($ability) : null);

        // The platform's own pages, which see every company.
        Gate::define('view-admin-dashboard', fn (User $user): bool => (bool) $user->is_admin);
        Gate::define('manage-configuration', fn (User $user): bool => (bool) $user->is_admin);

        // Whether a staff member's sign-in reaches beyond the staff pages; only such a sign-in may open them to another.
        Gate::define('use-app', fn (User $user): bool => $user->canUseApp());
    }
}
