<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Cash a short-term tenant pays is collected on site by the camp boss,
     * who hands it to the company later. A cash receipt remembers when an
     * admin confirmed receiving it and who that admin was; until then the
     * money is still with the camp boss.
     */
    public function up(): void
    {
        Schema::table('rental_payments', function (Blueprint $table) {
            $table->timestamp('handed_over_at')->nullable()->after('received_by');
            $table->foreignId('handed_over_to')->nullable()->after('handed_over_at')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rental_payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('handed_over_to');
            $table->dropColumn('handed_over_at');
        });
    }
};
