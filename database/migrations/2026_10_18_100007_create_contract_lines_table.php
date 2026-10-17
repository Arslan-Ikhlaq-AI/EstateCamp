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
     * One thing a contract rents, at its own monthly rate:
     * - bed: `quantity` beds in the property, optionally in one room;
     * - room, apartment, shop: that one unit.
     *
     * The rate is stored on the line, so changing a room's list price never
     * rewrites a signed contract. Composite foreign keys tie the unit to the
     * line's property and the property to the contract's company. The check
     * constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('contract_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('contract_id');
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('room_id')->nullable();
            $table->unsignedBigInteger('apartment_id')->nullable();
            $table->unsignedBigInteger('shop_id')->nullable();
            $table->string('unit_type', 20);
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->decimal('monthly_rate', 12, 2);
            $table->string('billing_basis', 20)->default('contracted');
            $table->decimal('vat_rate', 5, 2)->default(0);
            $table->date('start_date');
            $table->date('end_date');
            $table->string('description')->nullable();
            $table->timestamps();

            $table->foreign(['contract_id', 'company_id'])->references(['id', 'company_id'])->on('contracts')->cascadeOnDelete();
            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->foreign(['room_id', 'property_id'])->references(['id', 'property_id'])->on('rooms')->restrictOnDelete();
            $table->foreign(['apartment_id', 'property_id'])->references(['id', 'property_id'])->on('apartments')->restrictOnDelete();
            $table->foreign(['shop_id', 'property_id'])->references(['id', 'property_id'])->on('shops')->restrictOnDelete();
            // Target for occupancies' (contract_line_id, company_id) foreign key.
            $table->unique(['id', 'company_id']);
            $table->index('contract_id');
            $table->index('property_id');
            $table->index('room_id');
            $table->index('apartment_id');
            $table->index('shop_id');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table contract_lines
                add constraint contract_lines_unit_type_check check (unit_type in ('bed', 'room', 'apartment', 'shop')),
                add constraint contract_lines_unit_check check (
                    (unit_type = 'bed' and apartment_id is null and shop_id is null)
                    or (unit_type = 'room' and room_id is not null and apartment_id is null and shop_id is null)
                    or (unit_type = 'apartment' and apartment_id is not null and room_id is null and shop_id is null)
                    or (unit_type = 'shop' and shop_id is not null and room_id is null and apartment_id is null)
                ),
                add constraint contract_lines_quantity_check check (quantity >= 1 and (unit_type = 'bed' or quantity = 1)),
                add constraint contract_lines_billing_basis_check check (
                    billing_basis in ('contracted', 'actual') and (billing_basis = 'contracted' or unit_type = 'bed')
                ),
                add constraint contract_lines_rate_check check (monthly_rate >= 0 and vat_rate between 0 and 100),
                add constraint contract_lines_dates_check check (end_date >= start_date)"
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contract_lines');
    }
};
