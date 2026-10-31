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
     * Rooms are rented whole, never bed by bed:
     * - rooms: the bed rate becomes the room's `monthly_rent` (rate × beds,
     *   so the list price is unchanged), and the count of beds taken becomes
     *   `is_occupied`. `capacity` stays as how many people the room sleeps.
     * - contract_lines: bed lines in a room become whole-room lines at the
     *   same monthly money, and the bed-only `quantity` and `billing_basis`
     *   go. A bed line with no room, or whose room another line also holds,
     *   cannot be converted, so the migration stops and names it.
     * - occupancies: a stay is in a room, not a bed. A room holds as many
     *   people as it sleeps, so the one-person-per-bed constraint goes.
     * - beds: dropped.
     */
    public function up(): void
    {
        $this->guardBedLines();

        $isPostgres = DB::getDriverName() === 'pgsql';

        if ($isPostgres) {
            DB::statement(
                'alter table contract_lines
                drop constraint if exists contract_lines_unit_type_check,
                drop constraint if exists contract_lines_unit_check,
                drop constraint if exists contract_lines_quantity_check,
                drop constraint if exists contract_lines_billing_basis_check'
            );
            DB::statement('alter table rooms drop constraint if exists rooms_occupancy_check, drop constraint if exists rooms_rent_per_bed_check');
            DB::statement('alter table occupancies drop constraint if exists occupancies_bed_no_overlap');
        }

        DB::table('contract_lines')->where('unit_type', 'bed')->update([
            'unit_type' => 'room',
            'monthly_rate' => DB::raw('round(monthly_rate * quantity, 2)'),
        ]);

        Schema::table('contract_lines', function (Blueprint $table) {
            $table->dropColumn(['quantity', 'billing_basis']);
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->boolean('is_occupied')->default(false)->after('capacity');
            $table->decimal('monthly_rent', 12, 2)->nullable()->after('area_sqm');
        });

        DB::table('rooms')->update([
            'is_occupied' => DB::raw('occupied_count > 0'),
            'monthly_rent' => DB::raw('round(rent_per_bed * capacity, 2)'),
        ]);

        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['occupied_count', 'rent_per_bed']);
        });

        Schema::table('occupancies', function (Blueprint $table) {
            $table->foreignId('room_id')->nullable()->after('room_rental_id')->constrained('rooms')->restrictOnDelete();
        });

        DB::table('occupancies')->update([
            'room_id' => DB::raw('(select room_id from beds where beds.id = occupancies.bed_id)'),
        ]);

        Schema::table('occupancies', function (Blueprint $table) {
            $table->unsignedBigInteger('room_id')->nullable(false)->change();
            $table->dropForeign(['bed_id']);
            $table->dropColumn('bed_id');
        });

        Schema::dropIfExists('beds');

        if ($isPostgres) {
            DB::statement(
                "alter table contract_lines
                add constraint contract_lines_unit_type_check check (unit_type in ('room', 'apartment', 'shop')),
                add constraint contract_lines_unit_check check (
                    (unit_type = 'room' and room_id is not null and apartment_id is null and shop_id is null)
                    or (unit_type = 'apartment' and apartment_id is not null and room_id is null and shop_id is null)
                    or (unit_type = 'shop' and shop_id is not null and room_id is null and apartment_id is null)
                )"
            );
            DB::statement('alter table rooms add constraint rooms_capacity_check check (capacity > 0), add constraint rooms_monthly_rent_check check (monthly_rent >= 0)');
        }
    }

    /**
     * Reverse the migrations. Rooms get one bed per person they sleep back,
     * and each stay the first bed of its room free on its check-in day.
     * Lines converted from beds stay whole-room lines.
     */
    public function down(): void
    {
        $isPostgres = DB::getDriverName() === 'pgsql';

        if ($isPostgres) {
            DB::statement('alter table contract_lines drop constraint if exists contract_lines_unit_type_check, drop constraint if exists contract_lines_unit_check');
            DB::statement('alter table rooms drop constraint if exists rooms_capacity_check, drop constraint if exists rooms_monthly_rent_check');
        }

        Schema::create('beds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained('rooms')->cascadeOnDelete();
            $table->string('label', 20);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['room_id', 'label']);
        });

        DB::table('rooms')->orderBy('id')->select(['id', 'capacity'])->each(function (object $room) {
            DB::table('beds')->insert(array_map(
                fn (int $label) => ['room_id' => $room->id, 'label' => (string) $label, 'created_at' => now(), 'updated_at' => now()],
                range(1, max(1, (int) $room->capacity)),
            ));
        });

        Schema::table('occupancies', function (Blueprint $table) {
            $table->foreignId('bed_id')->nullable()->after('room_rental_id')->constrained('beds')->restrictOnDelete();
        });

        DB::table('occupancies')->orderBy('check_in_date')->orderBy('id')->get()->groupBy('room_id')->each(function ($stays, $roomId) {
            $beds = DB::table('beds')->where('room_id', $roomId)->orderBy('id')->pluck('id')->all();
            $freeFrom = array_fill_keys($beds, null);

            foreach ($stays as $stay) {
                $bedId = collect($freeFrom)->search(fn (?string $from) => $from === null || $from <= $stay->check_in_date);

                if ($bedId === false) {
                    $bedId = DB::table('beds')->insertGetId(['room_id' => $roomId, 'label' => (string) (count($freeFrom) + 1), 'is_active' => false, 'created_at' => now(), 'updated_at' => now()]);
                }

                $freeFrom[$bedId] = $stay->check_out_date ?? '9999-12-31';
                DB::table('occupancies')->where('id', $stay->id)->update(['bed_id' => $bedId]);
            }
        });

        Schema::table('occupancies', function (Blueprint $table) {
            $table->unsignedBigInteger('bed_id')->nullable(false)->change();
            $table->dropForeign(['room_id']);
            $table->dropColumn('room_id');
        });

        Schema::table('rooms', function (Blueprint $table) {
            $table->unsignedSmallInteger('occupied_count')->default(0)->after('capacity');
            $table->decimal('rent_per_bed', 12, 2)->nullable()->after('area_sqm');
        });

        DB::table('rooms')->update([
            'occupied_count' => DB::raw('case when is_occupied then capacity else 0 end'),
            'rent_per_bed' => DB::raw('round(monthly_rent / capacity, 2)'),
        ]);

        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['is_occupied', 'monthly_rent']);
        });

        Schema::table('contract_lines', function (Blueprint $table) {
            $table->unsignedSmallInteger('quantity')->default(1)->after('unit_type');
            $table->string('billing_basis', 20)->default('contracted')->after('monthly_rate');
        });

        if ($isPostgres) {
            DB::statement(
                "alter table occupancies add constraint occupancies_bed_no_overlap exclude using gist (
                    bed_id with =,
                    daterange(check_in_date, check_out_date, '[)') with &&
                )"
            );
            DB::statement(
                'alter table rooms
                add constraint rooms_occupancy_check check (capacity > 0 and occupied_count between 0 and capacity),
                add constraint rooms_rent_per_bed_check check (rent_per_bed >= 0)'
            );
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
                )"
            );
        }
    }

    /**
     * Stop before changing anything when a bed line cannot become a whole
     * room: it names no room, or its room is held by another line on some
     * of the same days.
     */
    private function guardBedLines(): void
    {
        $bedLines = DB::table('contract_lines')
            ->join('contracts', 'contracts.id', '=', 'contract_lines.contract_id')
            ->where('contract_lines.unit_type', 'bed')
            ->get(['contract_lines.id', 'contract_lines.room_id', 'contract_lines.start_date', 'contract_lines.end_date', 'contracts.contract_number']);

        $problems = $bedLines->map(function (object $line) {
            if ($line->room_id === null) {
                return "{$line->contract_number} rents beds anywhere in a property rather than a room";
            }

            $sharesRoom = DB::table('contract_lines')
                ->where('room_id', $line->room_id)
                ->whereIn('unit_type', ['bed', 'room'])
                ->where('id', '!=', $line->id)
                ->whereDate('start_date', '<=', $line->end_date)
                ->whereDate('end_date', '>=', $line->start_date)
                ->exists();

            return $sharesRoom ? "{$line->contract_number} rents beds in a room another line also holds" : null;
        })->filter();

        if ($problems->isNotEmpty()) {
            throw new RuntimeException('Rooms are now rented whole, but these bed lines cannot be converted automatically: '.$problems->unique()->implode('; ').'. Change them to whole rooms first.');
        }
    }
};
