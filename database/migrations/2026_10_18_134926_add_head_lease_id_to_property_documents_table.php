<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The head lease a document was filed under, such as the contract and the
     * landlord's ID uploaded with a leased property. Documents outlive leases.
     */
    public function up(): void
    {
        Schema::table('property_documents', function (Blueprint $table) {
            $table->foreignId('head_lease_id')->nullable()->after('property_id')->constrained()->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('property_documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('head_lease_id');
        });
    }
};
