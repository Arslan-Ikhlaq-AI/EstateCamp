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
     * Each cheque is in one of the company's named statuses, always one of
     * the stage in its `status` column; the Cheque model keeps the two in
     * step. Existing cheques take the first status of their stage.
     */
    public function up(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->foreignId('cheque_status_id')->nullable()->after('status')->constrained('cheque_statuses')->restrictOnDelete();
        });

        $firstOfEachStage = DB::table('cheque_statuses')->orderBy('sort_order')->orderBy('id')->get()->unique('stage');

        foreach ($firstOfEachStage as $status) {
            DB::table('cheques')->where('status', $status->stage)->whereNull('cheque_status_id')->update(['cheque_status_id' => $status->id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cheque_status_id');
        });
    }
};
