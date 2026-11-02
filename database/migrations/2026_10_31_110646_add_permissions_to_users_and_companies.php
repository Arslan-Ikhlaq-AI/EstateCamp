<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The two layers of access (see config/permissions.php). A company's
     * `disabled_features` are the pages the platform has switched off for
     * it, so a page added later is on until someone switches it off. A
     * user's `permissions` are what their company chose for them, replacing
     * their role's defaults; null means the defaults, so a permission added
     * later reaches them only when their role has it.
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->json('disabled_features')->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->json('permissions')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('permissions');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('disabled_features');
        });
    }
};
