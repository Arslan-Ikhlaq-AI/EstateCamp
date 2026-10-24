<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The slug is the company's workspace address (/w/{slug}). It stays unique
     * across removed companies too, so an old link never opens someone else's
     * workspace. Companies created before onboarding get one from their name.
     */
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('slug', 40)->nullable()->unique();
            $table->string('business_type', 40)->nullable();
        });

        $taken = [];

        DB::table('companies')->orderBy('id')->get(['id', 'name', 'short_name'])->each(function (object $company) use (&$taken) {
            $base = Str::limit(Str::slug($company->short_name ?: $company->name), 34, '') ?: 'company';
            $slug = $base;

            for ($suffix = 2; in_array($slug, $taken, true); $suffix++) {
                $slug = "{$base}-{$suffix}";
            }

            $taken[] = $slug;
            DB::table('companies')->where('id', $company->id)->update(['slug' => $slug]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn(['slug', 'business_type']);
        });
    }
};
