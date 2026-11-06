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
     * Extra payments are money the company holds outside its main books:
     * the commission and the security deposit taken with a contract or a
     * short-term rental, and extra income. None of it reaches payments,
     * revenue or the reports.
     *
     * A commission or deposit belongs to one agreement. It is pending until
     * the money arrives, by cash or cheque, and the cheque's details stay on
     * the row, away from the cheque register. Settlements record the money
     * going out again, to anyone and in any number of parts; `settled_amount`
     * keeps their total on the record so lists can filter and sum on it.
     *
     * Composite foreign keys tie each record to its company. The check
     * constraints are PostgreSQL-only.
     */
    public function up(): void
    {
        Schema::create('commissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('commission_number', 30);
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('client_id');
            $table->string('agreement_type', 30);
            $table->unsignedBigInteger('agreement_id');

            // A percentage of the rent keeps its rate; an exact amount has none.
            $table->decimal('rate', 5, 2)->nullable();
            $table->decimal('amount', 14, 2);
            $table->decimal('settled_amount', 14, 2)->default(0);

            $table->string('status', 20)->default('pending');
            $table->date('received_on')->nullable();
            $table->string('method', 20)->nullable();
            $table->string('cheque_number', 30)->nullable();
            $table->string('bank_name')->nullable();
            $table->date('cheque_date')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->foreign(['client_id', 'company_id'])->references(['id', 'company_id'])->on('clients')->restrictOnDelete();
            $table->unique(['company_id', 'commission_number']);
            $table->unique(['agreement_type', 'agreement_id']);
            $table->index(['company_id', 'status', 'received_on']);
            $table->index(['property_id', 'received_on']);
        });

        Schema::create('deposits', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->string('deposit_number', 30);
            $table->unsignedBigInteger('property_id');
            $table->unsignedBigInteger('client_id');
            $table->string('agreement_type', 30);
            $table->unsignedBigInteger('agreement_id');

            $table->decimal('amount', 14, 2);
            $table->decimal('settled_amount', 14, 2)->default(0);

            $table->string('status', 20)->default('pending');
            $table->date('received_on')->nullable();
            $table->string('method', 20)->nullable();
            $table->string('cheque_number', 30)->nullable();
            $table->string('bank_name')->nullable();
            $table->date('cheque_date')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign(['property_id', 'company_id'])->references(['id', 'company_id'])->on('properties')->restrictOnDelete();
            $table->foreign(['client_id', 'company_id'])->references(['id', 'company_id'])->on('clients')->restrictOnDelete();
            $table->unique(['company_id', 'deposit_number']);
            $table->unique(['agreement_type', 'agreement_id']);
            $table->index(['company_id', 'status', 'received_on']);
            $table->index(['property_id', 'received_on']);
        });

        Schema::create('settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->restrictOnDelete();
            $table->string('settleable_type', 30);
            $table->unsignedBigInteger('settleable_id');

            $table->date('settled_on');
            $table->decimal('amount', 14, 2);
            $table->string('paid_to')->nullable();
            $table->string('method', 20);
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['settleable_type', 'settleable_id']);
            $table->index(['company_id', 'settled_on']);
        });

        Schema::table('extra_incomes', function (Blueprint $table) {
            $table->decimal('settled_amount', 14, 2)->default(0)->after('amount');
        });

        if (DB::getDriverName() === 'pgsql') {
            foreach (['commissions', 'deposits'] as $records) {
                DB::statement(
                    "alter table {$records}
                    add constraint {$records}_status_check check (status in ('pending', 'received', 'cancelled')),
                    add constraint {$records}_method_check check (method in ('cash', 'cheque', 'bank_transfer', 'card')),
                    add constraint {$records}_agreement_check check (agreement_type in ('contract', 'room_rental')),
                    add constraint {$records}_amounts_check check (amount > 0 and settled_amount >= 0 and settled_amount <= amount),
                    add constraint {$records}_received_check check (status <> 'received' or (received_on is not null and method is not null))"
                );
            }

            DB::statement('alter table commissions add constraint commissions_rate_check check (rate > 0 and rate <= 100)');
            DB::statement(
                "alter table settlements
                add constraint settlements_kind_check check (settleable_type in ('commission', 'deposit', 'extra_income')),
                add constraint settlements_method_check check (method in ('cash', 'bank_transfer', 'cheque')),
                add constraint settlements_amount_check check (amount > 0)"
            );
            DB::statement('alter table extra_incomes add constraint extra_incomes_settled_check check (settled_amount >= 0 and settled_amount <= amount)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('extra_incomes', function (Blueprint $table) {
            $table->dropColumn('settled_amount');
        });

        Schema::dropIfExists('settlements');
        Schema::dropIfExists('deposits');
        Schema::dropIfExists('commissions');
    }
};
