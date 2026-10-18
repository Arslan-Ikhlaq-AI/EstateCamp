<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A leased property points at one of the company's landlords instead of
 * keeping its own copy of the landlord's name and phone. Existing names are
 * matched to a landlord of the same company (ignoring case), or become a new
 * landlord, before the old columns are dropped.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->unsignedBigInteger('landlord_id')->nullable()->after('ownership_type');
        });

        DB::table('properties')
            ->whereNotNull('landlord_name')
            ->where('landlord_name', '!=', '')
            ->orderBy('id')
            ->each(function (object $property) {
                $landlordId = DB::table('landlords')
                    ->where('company_id', $property->company_id)
                    ->whereNull('deleted_at')
                    ->whereRaw('lower(name) = ?', [mb_strtolower(trim($property->landlord_name))])
                    ->value('id');

                $landlordId ??= DB::table('landlords')->insertGetId([
                    'company_id' => $property->company_id,
                    'landlord_type' => 'company',
                    'name' => trim($property->landlord_name),
                    'phone' => $property->landlord_phone,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('properties')->where('id', $property->id)->update(['landlord_id' => $landlordId]);
            });

        Schema::table('properties', function (Blueprint $table) {
            $table->foreign(['landlord_id', 'company_id'])->references(['id', 'company_id'])->on('landlords')->restrictOnDelete();
            $table->index('landlord_id');
            $table->dropColumn(['landlord_name', 'landlord_phone']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->string('landlord_name')->nullable()->after('ownership_type');
            $table->string('landlord_phone', 40)->nullable()->after('landlord_name');
        });

        DB::table('properties')
            ->whereNotNull('landlord_id')
            ->orderBy('id')
            ->each(function (object $property) {
                $landlord = DB::table('landlords')->where('id', $property->landlord_id)->first(['name', 'phone']);

                DB::table('properties')->where('id', $property->id)->update([
                    'landlord_name' => $landlord?->name,
                    'landlord_phone' => $landlord?->phone,
                ]);
            });

        Schema::table('properties', function (Blueprint $table) {
            $table->dropForeign(['landlord_id', 'company_id']);
            $table->dropIndex(['landlord_id']);
            $table->dropColumn('landlord_id');
        });
    }
};
