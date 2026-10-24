<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A cheque's history: each time someone moved it from one status to
     * another, on which day, and why.
     */
    public function up(): void
    {
        Schema::create('cheque_updates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cheque_id')->constrained('cheques')->cascadeOnDelete();
            $table->foreignId('cheque_status_id')->constrained('cheque_statuses')->restrictOnDelete();
            $table->foreignId('previous_status_id')->nullable()->constrained('cheque_statuses')->restrictOnDelete();
            $table->date('changed_on');
            $table->text('note')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['cheque_id', 'changed_on']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cheque_updates');
    }
};
