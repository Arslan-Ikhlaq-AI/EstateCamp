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
     * The date check constraint is PostgreSQL-only; the SQLite database used by the
     * test suite cannot add it to an existing table.
     */
    public function up(): void
    {
        Schema::create('property_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->string('document_type', 40);
            $table->string('title')->nullable();
            $table->string('document_number', 100)->nullable();
            $table->string('file_url', 2048);
            $table->date('issued_on')->nullable();
            $table->date('expires_on')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['property_id', 'document_type']);
        });

        // Partial index for the expiry-alert query: only live documents that actually expire.
        DB::statement(
            'create index property_documents_expires_on_index
            on property_documents (expires_on)
            where deleted_at is null and expires_on is not null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                'alter table property_documents
                add constraint property_documents_dates_check check (expires_on >= issued_on)'
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('property_documents');
    }
};
