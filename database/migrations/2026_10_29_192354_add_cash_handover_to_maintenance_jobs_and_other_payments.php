<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tables of bills a camp boss may pay in cash out of what was collected.
     *
     * @var list<string>
     */
    private array $tables = ['maintenance_jobs', 'other_payments'];

    /**
     * Run the migrations.
     *
     * A bill paid in cash at a property is paid by the camp boss out of the
     * cash collected there, and comes off what is handed to the company. It
     * remembers when an admin settled it in a handover and who that was.
     */
    public function up(): void
    {
        foreach ($this->tables as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->timestamp('handed_over_at')->nullable()->after('paid_by');
                $table->foreignId('handed_over_to')->nullable()->after('handed_over_at')->constrained('users')->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach ($this->tables as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropConstrainedForeignId('handed_over_to');
                $table->dropColumn('handed_over_at');
            });
        }
    }
};
