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
     * The statuses a cheque moves through, named by the company (such as
     * Created → Submitted → Approved, or Bounced). Each status belongs to a
     * stage the application understands, which is the cheque's own `status`:
     * moving a cheque into a status of the `cleared` stage records its
     * payment, one of the `bounced` stage takes the payment back. A cheque
     * entering a stage takes the stage's first active status, in order.
     *
     * The starter rows are inserted here so every cheque can be given one,
     * in every environment. Add or rename statuses through the application.
     * The check constraints are PostgreSQL-only; the SQLite test database
     * cannot add them to an existing table.
     */
    public function up(): void
    {
        Schema::create('cheque_statuses', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('stage', 20)->default('pending');
            $table->string('color', 20)->default('cyan');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['stage', 'sort_order']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table cheque_statuses
                add constraint cheque_statuses_stage_check check (stage in ('pending', 'received', 'issued', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled')),
                add constraint cheque_statuses_color_check check (color in ('cyan', 'navy', 'amber', 'green', 'red', 'grey'))"
            );
        }

        $now = now();

        DB::table('cheque_statuses')->insert(array_map(fn (array $status) => [...$status, 'created_at' => $now, 'updated_at' => $now], [
            ['name' => 'Pending', 'slug' => 'pending', 'stage' => 'pending', 'color' => 'grey', 'sort_order' => 1, 'description' => 'Expected under the agreement; its number and bank are not recorded yet.'],
            ['name' => 'Created', 'slug' => 'created', 'stage' => 'received', 'color' => 'cyan', 'sort_order' => 2, 'description' => 'Received from the client, with its number and bank recorded.'],
            ['name' => 'Issued', 'slug' => 'issued', 'stage' => 'issued', 'color' => 'navy', 'sort_order' => 3, 'description' => 'Written and handed over to the landlord.'],
            ['name' => 'Submitted', 'slug' => 'submitted', 'stage' => 'deposited', 'color' => 'amber', 'sort_order' => 4, 'description' => 'Deposited at the bank, waiting for the money.'],
            ['name' => 'Approved', 'slug' => 'approved', 'stage' => 'cleared', 'color' => 'green', 'sort_order' => 5, 'description' => 'The bank paid it: the payment is received, or paid out to the landlord.'],
            ['name' => 'Bounced', 'slug' => 'bounced', 'stage' => 'bounced', 'color' => 'red', 'sort_order' => 6, 'description' => 'Returned unpaid by the bank; a replacement cheque is needed.'],
            ['name' => 'Returned', 'slug' => 'returned', 'stage' => 'returned', 'color' => 'grey', 'sort_order' => 7, 'description' => 'Handed back to the client uncashed.'],
            ['name' => 'Cancelled', 'slug' => 'cancelled', 'stage' => 'cancelled', 'color' => 'grey', 'sort_order' => 8, 'description' => 'No longer used.'],
        ]));
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cheque_statuses');
    }
};
