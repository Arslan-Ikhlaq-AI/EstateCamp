<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Both columns are nullable so existing users and self-registration keep working
     * until roles and companies are assigned. Restrict-on-delete stops a role or
     * company that still has users from being deleted.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('user_role_id')->nullable()->index()->constrained('user_roles')->restrictOnDelete();
            $table->foreignId('company_id')->nullable()->index()->constrained('companies')->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_role_id');
            $table->dropConstrainedForeignId('company_id');
        });
    }
};
