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
     * The raw index, sequence and constraint statements are PostgreSQL-only; the
     * SQLite database used by the test suite cannot run them.
     */
    public function up(): void
    {
        $isPostgres = DB::getDriverName() === 'pgsql';

        Schema::rename('company', 'companies');

        if ($isPostgres) {
            DB::statement('alter index company_pkey rename to companies_pkey');
            DB::statement('alter sequence company_id_seq rename to companies_id_seq');
        }

        if (Schema::hasColumn('companies', 'slug')) {
            Schema::dropColumns('companies', 'slug');
        }

        Schema::table('companies', function (Blueprint $table) {
            $table->renameIndex('company_status_index', 'companies_status_index');

            $table->text('description')->nullable();
            $table->string('logo_url', 2048)->nullable();
            $table->string('website', 2048)->nullable();

            $table->string('contact_person_name')->nullable();
            $table->string('contact_person_phone', 40)->nullable();
            $table->string('contact_person_email')->nullable();

            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('country_code', 2)->default('AE');

            $table->date('expiry_date')->nullable();
        });

        // Partial unique index: a soft-deleted company must not block re-registering the same TRN.
        DB::statement(
            'create unique index companies_tax_registration_number_unique
            on companies (tax_registration_number)
            where deleted_at is null'
        );

        if ($isPostgres) {
            // Allowed status values, plus upper-case ISO 3166-1 alpha-2 country and ISO 4217 currency codes.
            DB::statement(
                "alter table companies
                add constraint companies_status_check check (status in ('active', 'inactive', 'suspended')),
                add constraint companies_country_code_check check (country_code ~ '^[A-Z]{2}$'),
                add constraint companies_default_currency_check check (default_currency ~ '^[A-Z]{3}$')"
            );
        }
    }

    /**
     * Reverse the migrations.
     *
     * The `slug` column dropped by up() is not restored.
     */
    public function down(): void
    {
        $isPostgres = DB::getDriverName() === 'pgsql';

        DB::statement('drop index if exists companies_tax_registration_number_unique');

        if ($isPostgres) {
            DB::statement(
                'alter table companies
                drop constraint if exists companies_status_check,
                drop constraint if exists companies_default_currency_check'
            );
        }

        Schema::dropColumns('companies', [
            'description',
            'logo_url',
            'website',
            'contact_person_name',
            'contact_person_phone',
            'contact_person_email',
            'address_line_1',
            'address_line_2',
            'city',
            'state',
            'postal_code',
            'country_code',
            'expiry_date',
        ]);

        Schema::table('companies', function (Blueprint $table) {
            $table->renameIndex('companies_status_index', 'company_status_index');
        });

        if ($isPostgres) {
            DB::statement('alter sequence companies_id_seq rename to company_id_seq');
            DB::statement('alter index companies_pkey rename to company_pkey');
        }

        Schema::rename('companies', 'company');
    }
};
