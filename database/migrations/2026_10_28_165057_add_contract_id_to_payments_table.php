<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A payment collected towards one contract's bill remembers the
     * contract. What it pays beyond the contract's open invoices stays on it
     * as credit and settles the contract's next invoices as they are
     * issued. The (contract_id, client_id) foreign key keeps the contract
     * one of the paying client's.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedBigInteger('contract_id')->nullable()->after('client_id');

            $table->foreign(['contract_id', 'client_id'])->references(['id', 'client_id'])->on('contracts')->restrictOnDelete();
            $table->index('contract_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['contract_id', 'client_id']);
            $table->dropIndex(['contract_id']);
            $table->dropColumn('contract_id');
        });
    }
};
