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
     * The check constraints are PostgreSQL-only; the SQLite database used by the
     * test suite cannot add them to an existing table.
     */
    public function up(): void
    {
        Schema::create('room_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();

            // File
            $table->string('attachment_type', 20)->default('image');
            $table->string('file_url', 2048);
            $table->string('thumbnail_url', 2048)->nullable();
            $table->string('original_name')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();

            // Presentation
            $table->string('caption')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_primary')->default(false);

            $table->foreignId('uploaded_by')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['room_id', 'sort_order']);
        });

        // Partial unique index: at most one live cover attachment per room.
        DB::statement(
            'create unique index room_attachments_room_id_primary_unique
            on room_attachments (room_id)
            where is_primary = true and deleted_at is null'
        );

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table room_attachments
                add constraint room_attachments_attachment_type_check check (attachment_type in ('image', 'video', 'document')),
                add constraint room_attachments_file_size_check check (file_size >= 0),
                add constraint room_attachments_primary_is_image_check check (not is_primary or attachment_type = 'image')"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_attachments');
    }
};
