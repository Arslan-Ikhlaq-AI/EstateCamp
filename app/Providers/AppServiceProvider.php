<?php

namespace App\Providers;

use App\Models\Contract;
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
            'contract' => Contract::class,
            'head_lease' => HeadLease::class,
            'maintenance_contract' => MaintenanceContract::class,
            'room_rental' => RoomRental::class,
        ]);

        Vite::prefetch(concurrency: 3);

        // Signing up checks each field as it is filled in, but a company (and its emails) can be created only a few times an hour.
        RateLimiter::for('onboarding', fn (Request $request) => $request->isAttemptingPrecognition()
            ? Limit::perMinute(120)->by($request->ip())
            : Limit::perHour(10)->by($request->ip()));

        Gate::define('view-admin-dashboard', fn (User $user): bool => (bool) $user->is_admin);
        Gate::define('manage-configuration', fn (User $user): bool => (bool) $user->is_admin);

        // Staff who sign in see what their access allows; everyone else keeps full access.
        Gate::define('use-app', fn (User $user): bool => $user->canUseApp());
        Gate::define('view-staff', fn (User $user): bool => in_array($user->staffAccess(), ['supervisor', 'admin'], true));
        Gate::define('manage-staff', fn (User $user): bool => $user->staffAccess() === 'admin');
    }
}
