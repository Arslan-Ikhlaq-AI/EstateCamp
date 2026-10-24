<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A staff member's own sign-in: the user account they log in with, and
     * what it lets them do (see the staff_roles access columns, which give
     * the starting point). Removing the account leaves the staff record in
     * place. The check constraint is PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::table('staff_members', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->unique()->after('company_id')->constrained('users')->nullOnDelete();
            $table->string('access', 20)->nullable()->after('user_id');
            $table->boolean('app_access')->default(false)->after('access');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table staff_members add constraint staff_members_access_check check (access in ('self', 'supervisor', 'admin'))");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table staff_members drop constraint if exists staff_members_access_check');
        }

        Schema::table('staff_members', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['access', 'app_access']);
        });
    }
};
