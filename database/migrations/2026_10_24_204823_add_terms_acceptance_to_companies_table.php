<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The record of a company accepting the Terms of Service at sign-up:
     * which version, when, and from which address. Companies created
     * before sign-up existed have none.
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('terms_version', 20)->nullable();
            $table->timestamp('terms_accepted_at')->nullable();
            $table->string('terms_accepted_ip', 45)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn(['terms_version', 'terms_accepted_at', 'terms_accepted_ip']);
        });
    }
};
