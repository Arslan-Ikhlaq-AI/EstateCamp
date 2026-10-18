<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Files kept with a client contract: the signed contract, the client's
     * trade licence, ID or passport, and anything else. The date check
     * constraint is PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('contract_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contract_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 40);
            $table->string('title')->nullable();
            $table->string('document_number', 100)->nullable();
            $table->string('file_url', 2048);
            $table->date('issued_on')->nullable();
            $table->date('expires_on')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['contract_id', 'document_type']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'alter table contract_documents
                add constraint contract_documents_dates_check check (expires_on >= issued_on)'
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contract_documents');
    }
};
