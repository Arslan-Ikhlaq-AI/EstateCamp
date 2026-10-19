<?php

namespace App\Providers;

use Illuminate\Database\Eloquent\Relations\Relation;
use App\Models\HeadLease;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
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
        ]);

        Vite::prefetch(concurrency: 3);

        Gate::define('view-admin-dashboard', fn (User $user): bool => (bool) $user->is_admin);
        Gate::define('manage-configuration', fn (User $user): bool => (bool) $user->is_admin);
    }
}
