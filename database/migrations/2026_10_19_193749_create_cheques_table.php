<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Every cheque the company receives (from clients) or issues (to
     * landlords, and later vendors) lives here, linked to the agreement it
     * pays for. The landlord instalments in head_lease_payments become issued
     * cheques, so that table is moved over and dropped. A client payment made
     * by clearing a cheque points back to it.
     *
     * The check constraints are PostgreSQL-only; the SQLite database used by
     * the test suite cannot add them to an existing table.
     */
    public function up(): void
    {
        Schema::create('cheques', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->restrictOnDelete();

            // Which way the money goes, and the agreement it belongs to (a client contract or a head lease).
            $table->string('direction', 10);
            $table->morphs('chequeable');
            $table->string('purpose', 30)->default('rent');
            $table->unsignedSmallInteger('sequence');

            // What the cheque pays for and when it can be presented.
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->date('cheque_date');
            $table->decimal('amount', 14, 2);

            // The paper itself.
            $table->string('cheque_number', 30)->nullable();
            $table->string('bank_name')->nullable();
            $table->string('account_holder')->nullable();
            $table->string('front_image_path', 2048)->nullable();
            $table->string('back_image_path', 2048)->nullable();

            // Lifecycle.
            $table->string('status', 20)->default('pending');
            $table->date('handed_over_on')->nullable();
            $table->date('deposited_on')->nullable();
            $table->date('cleared_on')->nullable();
            $table->date('bounced_on')->nullable();
            $table->string('bounce_reason')->nullable();
            $table->foreignId('replaces_id')->nullable()->constrained('cheques')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_id', 'direction', 'status', 'cheque_date']);
            $table->index(['chequeable_type', 'chequeable_id', 'purpose', 'sequence']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table cheques
                add constraint cheques_direction_check check (direction in ('received', 'issued')),
                add constraint cheques_purpose_check check (purpose in ('rent', 'security_deposit')),
                add constraint cheques_status_check check (status in ('pending', 'received', 'issued', 'deposited', 'cleared', 'bounced', 'returned', 'cancelled')),
                add constraint cheques_amount_check check (amount > 0),
                add constraint cheques_sequence_check check (sequence > 0),
                add constraint cheques_period_check check (period_end >= period_start),
                add constraint cheques_cleared_check check (status <> 'cleared' or cleared_on is not null),
                add constraint cheques_bounced_check check (status <> 'bounced' or bounced_on is not null)"
            );
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('cheque_id')->nullable()->unique()->after('client_id')->constrained('cheques')->nullOnDelete();
        });

        $this->moveLandlordInstalments();

        Schema::dropIfExists('head_lease_payments');
    }

    /**
     * Copy each landlord instalment into an issued rent cheque on its lease,
     * covering the months up to the next instalment.
     */
    private function moveLandlordInstalments(): void
    {
        if (! Schema::hasTable('head_lease_payments')) {
            return;
        }

        $statuses = ['paid' => 'cleared', 'bounced' => 'bounced', 'cancelled' => 'cancelled'];
        $methods = ['bank_transfer' => 'Paid by bank transfer.', 'cash' => 'Paid in cash.'];

        DB::table('head_lease_payments')
            ->join('head_leases', 'head_leases.id', '=', 'head_lease_payments.head_lease_id')
            ->select('head_lease_payments.*', 'head_leases.payments_per_year', 'head_leases.end_date as lease_end_date')
            ->orderBy('head_lease_payments.id')
            ->chunk(500, function ($instalments) use ($statuses, $methods) {
                $rows = [];

                foreach ($instalments as $instalment) {
                    $due = CarbonImmutable::parse($instalment->due_date);
                    $leaseEnd = CarbonImmutable::parse($instalment->lease_end_date);
                    $periodEnd = $due->addMonthsNoOverflow(intdiv(12, max(1, (int) $instalment->payments_per_year)))->subDay();
                    $status = $statuses[$instalment->status] ?? ($instalment->cheque_number ? 'issued' : 'pending');

                    $rows[] = [
                        'company_id' => $instalment->company_id,
                        'direction' => 'issued',
                        'chequeable_type' => 'head_lease',
                        'chequeable_id' => $instalment->head_lease_id,
                        'purpose' => 'rent',
                        'sequence' => $instalment->installment_number,
                        'period_start' => $due->toDateString(),
                        'period_end' => ($periodEnd->gt($leaseEnd) ? $leaseEnd : $periodEnd)->toDateString(),
                        'cheque_date' => $due->toDateString(),
                        'amount' => $instalment->amount,
                        'cheque_number' => $instalment->cheque_number,
                        'bank_name' => $instalment->bank_name,
                        'status' => $status,
                        'cleared_on' => $status === 'cleared' ? ($instalment->paid_on ?? $instalment->due_date) : null,
                        'bounced_on' => $status === 'bounced' ? substr((string) $instalment->updated_at, 0, 10) : null,
                        'notes' => trim(implode(' ', array_filter([
                            $methods[$instalment->payment_method] ?? null,
                            $instalment->reference ? "Reference {$instalment->reference}." : null,
                            $instalment->notes,
                        ]))) ?: null,
                        'created_at' => $instalment->created_at,
                        'updated_at' => $instalment->updated_at,
                    ];
                }

                DB::table('cheques')->insert($rows);
            });
    }

    /**
     * Reverse the migrations: rebuild head_lease_payments from the issued
     * head lease rent cheques (the originals, not their replacements).
     */
    public function down(): void
    {
        Schema::create('head_lease_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id');
            $table->unsignedBigInteger('head_lease_id');
            $table->unsignedSmallInteger('installment_number');
            $table->date('due_date');
            $table->decimal('amount', 14, 2);
            $table->string('payment_method', 20)->default('cheque');
            $table->string('cheque_number', 30)->nullable();
            $table->string('bank_name')->nullable();
            $table->string('status', 20)->default('scheduled');
            $table->date('paid_on')->nullable();
            $table->string('reference', 100)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign(['head_lease_id', 'company_id'])->references(['id', 'company_id'])->on('head_leases')->cascadeOnDelete();
            $table->unique(['head_lease_id', 'installment_number']);
            $table->index(['company_id', 'status', 'due_date']);
        });

        $statuses = ['cleared' => 'paid', 'bounced' => 'bounced', 'cancelled' => 'cancelled'];

        DB::table('cheques')
            ->where('chequeable_type', 'head_lease')
            ->where('purpose', 'rent')
            ->whereNull('replaces_id')
            ->orderBy('id')
            ->get()
            ->each(fn ($cheque) => DB::table('head_lease_payments')->insertOrIgnore([
                'company_id' => $cheque->company_id,
                'head_lease_id' => $cheque->chequeable_id,
                'installment_number' => $cheque->sequence,
                'due_date' => $cheque->cheque_date,
                'amount' => $cheque->amount,
                'cheque_number' => $cheque->cheque_number,
                'bank_name' => $cheque->bank_name,
                'status' => $statuses[$cheque->status] ?? 'scheduled',
                'paid_on' => $cheque->cleared_on,
                'notes' => $cheque->notes,
                'created_at' => $cheque->created_at,
                'updated_at' => $cheque->updated_at,
            ]));

        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cheque_id');
        });

        Schema::dropIfExists('cheques');
    }
};
