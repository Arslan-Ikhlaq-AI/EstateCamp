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
     * A room rental is an individual renting a bed, or a whole room, straight
     * from the company without a contract: a monthly rent from the start
     * date, an optional security deposit, and the person checked into one bed
     * for as long as they stay. `client_id` is who pays (an individual
     * client) and `occupant_id` the same person as they stay in the bed.
     *
     * Composite foreign keys tie every row to the rental's company and the
     * room to its property. The check constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('room_rentals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('rental_number', 30);

            // Who rents, and where they stay.
            $table->unsignedBigInteger('client_id');
            $table->unsignedBigInteger('occupant_id');
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('room_id');
            $table->foreignId('bed_id')->constrained('beds')->restrictOnDelete();
            $table->string('unit_type', 10)->default('bed');

            // The terms.
            $table->decimal('monthly_rent', 12, 2);
            $table->decimal('security_deposit', 12, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date')->nullable();

            // Moving out, and the deposit handed back.
            $table->string('status', 20)->default('active');
            $table->date('moved_out_on')->nullable();
            $table->decimal('deposit_refunded', 12, 2)->nullable();
            $table->date('deposit_refunded_on')->nullable();
            $table->string('deposit_refund_method', 20)->nullable();

            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['client_id', 'company_id'])->references(['id', 'company_id'])->on('clients')->restrictOnDelete();
            $table->foreign(['occupant_id', 'company_id'])->references(['id', 'company_id'])->on('occupants')->restrictOnDelete();
            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->foreign(['room_id', 'property_id'])->references(['id', 'property_id'])->on('rooms')->restrictOnDelete();
            $table->unique(['company_id', 'rental_number']);
            // Target for rental_payments' and occupancies' (room_rental_id, company_id) foreign keys.
            $table->unique(['id', 'company_id']);
            $table->index(['company_id', 'status']);
            $table->index('client_id');
            $table->index('room_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table room_rentals
                add constraint room_rentals_unit_type_check check (unit_type in ('bed', 'room')),
                add constraint room_rentals_status_check check (status in ('active', 'ended')),
                add constraint room_rentals_amounts_check check (monthly_rent > 0 and security_deposit >= 0 and deposit_refunded >= 0),
                add constraint room_rentals_dates_check check (end_date > start_date and moved_out_on > start_date),
                add constraint room_rentals_ended_check check (status <> 'ended' or moved_out_on is not null),
                add constraint room_rentals_refund_method_check check (deposit_refund_method in ('cash', 'bank_transfer', 'cheque'))"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('room_rentals');
    }
};
