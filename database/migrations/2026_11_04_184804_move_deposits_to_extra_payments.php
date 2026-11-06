<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The next deposit number by company and year.
     *
     * @var array<int, array<int, int>>
     */
    private array $numbers = [];

    /**
     * Run the migrations.
     *
     * Security deposits leave the main books for the deposits table, so what
     * was counted as a tenant's deposit stops being revenue.
     *
     * On a contract the deposit was a line on the first invoice and a
     * cheque in the register. The line comes off the invoice, and the part of
     * any receipt that paid it comes off that receipt; a receipt made for the
     * deposit cheque goes altogether. On a rental the deposit was a receipt,
     * which is voided so its number stays accounted for, and a refund becomes
     * a settlement. Deposit cheques leave the register, with their details
     * kept on the deposit. Head lease deposits are paid to a landlord and stay.
     *
     * The last cheque decides where a deposit stands: in hand or cleared is
     * received, returned is received and settled in full, cancelled is
     * cancelled, and anything else waits for the money. Without such a cheque,
     * money the receipts paid towards it counts as received.
     */
    public function up(): void
    {
        DB::table('contracts')->where('security_deposit', '>', 0)->orderBy('id')->get()->each(fn (object $contract) => $this->moveContractDeposit($contract));
        DB::table('room_rentals')->orderBy('id')->get()->each(fn (object $rental) => $this->moveRentalDeposit($rental));

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table room_rentals drop constraint room_rentals_amounts_check, drop constraint room_rentals_refund_method_check');
        }

        Schema::table('room_rentals', function (Blueprint $table) {
            $table->dropColumn(['deposit_refunded', 'deposit_refunded_on', 'deposit_refund_method']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table room_rentals add constraint room_rentals_amounts_check check (monthly_rent > 0 and security_deposit >= 0)');
        }
    }

    /**
     * Reverse the migrations. The columns come back empty; the money stays
     * in the deposits table, as the receipts and invoices it left are gone.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table room_rentals drop constraint room_rentals_amounts_check');
        }

        Schema::table('room_rentals', function (Blueprint $table) {
            $table->decimal('deposit_refunded', 12, 2)->nullable();
            $table->date('deposit_refunded_on')->nullable();
            $table->string('deposit_refund_method', 20)->nullable();
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "alter table room_rentals
                add constraint room_rentals_amounts_check check (monthly_rent > 0 and security_deposit >= 0 and deposit_refunded >= 0),
                add constraint room_rentals_refund_method_check check (deposit_refund_method in ('cash', 'bank_transfer', 'cheque'))"
            );
        }
    }

    /**
     * Take a contract's deposit off its invoices, receipts and cheques.
     */
    private function moveContractDeposit(object $contract): void
    {
        $cheques = $this->depositCheques('contract', $contract->id);

        DB::table('payment_allocations')->whereIn('payment_id', DB::table('payments')->whereIn('cheque_id', $cheques->pluck('id'))->select('id'))->delete();
        DB::table('payments')->whereIn('cheque_id', $cheques->pluck('id'))->delete();

        $paidBy = DB::table('invoice_items')
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->where('invoices.contract_id', $contract->id)
            ->where('invoice_items.item_type', 'deposit')
            ->where('invoices.status', '!=', 'void')
            ->get(['invoice_items.id', 'invoice_items.invoice_id', 'invoice_items.amount', 'invoice_items.vat_amount'])
            ->map(fn (object $item) => $this->removeInvoiceItem($item))
            ->filter()
            ->last();

        $propertyId = DB::table('contract_lines')
            ->where('contract_id', $contract->id)
            ->groupBy('property_id')
            ->orderByRaw('count(*) desc')
            ->orderBy('property_id')
            ->value('property_id');

        if ($propertyId !== null) {
            $state = $this->chequeState($cheques);
            $money = $state['status'] === 'pending' && $paidBy
                ? ['status' => 'received', 'received_on' => $paidBy->received_on, 'method' => $paidBy->method]
                : $state;

            $this->addDeposit($contract, 'contract', $propertyId, (float) $contract->security_deposit, $money);
        }

        DB::table('cheques')->whereIn('id', $cheques->pluck('id'))->delete();
    }

    /**
     * Take a deposit line off its invoice, and the money that paid for it off
     * the latest receipts. Gives the last receipt that paid for it, if any.
     */
    private function removeInvoiceItem(object $item): ?object
    {
        $invoice = DB::table('invoices')->where('id', $item->invoice_id)->first();
        $total = round((float) $invoice->total - (float) $item->amount - (float) $item->vat_amount, 2);
        $allocations = DB::table('payment_allocations')
            ->join('payments', 'payments.id', '=', 'payment_allocations.payment_id')
            ->where('payment_allocations.invoice_id', $invoice->id)
            ->where('payments.status', 'cleared')
            ->orderByDesc('payments.received_on')
            ->orderByDesc('payments.id')
            ->get(['payment_allocations.id', 'payment_allocations.amount', 'payments.id as payment_id', 'payments.amount as payment_amount', 'payments.received_on', 'payments.method']);
        $paid = round((float) $allocations->sum('amount'), 2);
        $excess = round(max(0, $paid - $total), 2);
        $paidBy = null;

        foreach ($allocations as $allocation) {
            if ($excess <= 0) {
                break;
            }

            $taken = min($excess, (float) $allocation->amount);
            $excess = round($excess - $taken, 2);
            $paid = round($paid - $taken, 2);
            $paidBy ??= $allocation;
            $this->reduceAllocation($allocation, $taken);
        }

        DB::table('invoice_items')->where('id', $item->id)->delete();
        DB::table('invoices')->where('id', $invoice->id)->update([
            'subtotal' => round((float) $invoice->subtotal - (float) $item->amount, 2),
            'vat_amount' => round((float) $invoice->vat_amount - (float) $item->vat_amount, 2),
            'total' => $total,
            'amount_paid' => min($paid, $total),
            'status' => match (true) {
                $paid >= $total => 'paid',
                $paid > 0 => 'partially_paid',
                default => 'issued',
            },
        ]);

        return $paidBy;
    }

    /**
     * Take `$amount` off an allocation and its receipt, removing whichever
     * comes to nothing.
     */
    private function reduceAllocation(object $allocation, float $amount): void
    {
        $left = round((float) $allocation->amount - $amount, 2);
        $receipt = round((float) DB::table('payments')->where('id', $allocation->payment_id)->value('amount') - $amount, 2);

        if ($left > 0) {
            DB::table('payment_allocations')->where('id', $allocation->id)->update(['amount' => $left]);
        } else {
            DB::table('payment_allocations')->where('id', $allocation->id)->delete();
        }

        if ($receipt > 0) {
            DB::table('payments')->where('id', $allocation->payment_id)->update(['amount' => $receipt]);
        } else {
            DB::table('payments')->where('id', $allocation->payment_id)->delete();
        }
    }

    /**
     * Take a rental's deposit off its receipts and cheques. What was
     * actually paid becomes the deposit, and a refund a settlement.
     */
    private function moveRentalDeposit(object $rental): void
    {
        $cheques = $this->depositCheques('room_rental', $rental->id);
        $receipts = DB::table('rental_payments')->where('room_rental_id', $rental->id)->where('purpose', 'deposit')->where('status', 'cleared')->orderBy('paid_on')->orderBy('id')->get();
        $paid = round((float) $receipts->sum('amount'), 2);
        $amount = $paid > 0 ? $paid : (float) $rental->security_deposit;

        if ($amount > 0) {
            $state = $this->chequeState($cheques);
            $money = $paid > 0 ? ['status' => 'received', 'received_on' => $receipts->first()->paid_on, 'method' => $receipts->last()->method, ...array_intersect_key($state, array_flip(['cheque_number', 'bank_name', 'cheque_date']))] : $state;
            $depositId = $this->addDeposit($rental, 'room_rental', $rental->property_id, $amount, $money);
            $refund = min($amount, (float) $rental->deposit_refunded);

            if ($refund > 0 && $money['status'] === 'received') {
                $this->addSettlement($rental, $depositId, $refund, $rental->deposit_refunded_on ?? $rental->moved_out_on, $rental->deposit_refund_method ?? 'cash', 'Handed back when moving out.');
            }

            DB::table('room_rentals')->where('id', $rental->id)->update(['security_deposit' => $amount]);
        }

        DB::table('rental_payments')->whereIn('id', $receipts->pluck('id'))->update([
            'status' => 'void',
            'voided_on' => now()->toDateString(),
            'void_reason' => 'Moved to Extra payments.',
        ]);
        DB::table('cheques')->whereIn('id', $cheques->pluck('id'))->delete();
    }

    /**
     * @return Collection<int, object>
     */
    private function depositCheques(string $type, int $id): Collection
    {
        return DB::table('cheques')->where('chequeable_type', $type)->where('chequeable_id', $id)->where('purpose', 'security_deposit')->orderBy('id')->get();
    }

    /**
     * Where the deposit stands going by its last cheque.
     *
     * @param  Collection<int, object>  $cheques
     * @return array<string, mixed>
     */
    private function chequeState(Collection $cheques): array
    {
        $replaced = $cheques->pluck('replaces_id')->filter();
        $cheque = $cheques->reject(fn (object $cheque) => $replaced->contains($cheque->id))->last();

        if ($cheque === null) {
            return ['status' => 'pending'];
        }

        $details = ['cheque_number' => $cheque->cheque_number, 'bank_name' => $cheque->bank_name, 'cheque_date' => $cheque->cheque_date];

        return match ($cheque->status) {
            'received', 'deposited', 'cleared' => ['status' => 'received', 'received_on' => $cheque->cleared_on ?? $cheque->deposited_on ?? $cheque->handed_over_on ?? $cheque->cheque_date, 'method' => 'cheque', ...$details],
            'returned' => ['status' => 'received', 'received_on' => $cheque->cheque_date, 'method' => 'cheque', 'returned_on' => $cheque->handed_over_on ?? $cheque->cheque_date, ...$details],
            'cancelled' => ['status' => 'cancelled', ...$details],
            default => ['status' => 'pending', ...$details],
        };
    }

    /**
     * Add the deposit, settled in full when its cheque was handed back.
     *
     * @param  array<string, mixed>  $money
     */
    private function addDeposit(object $agreement, string $type, int $propertyId, float $amount, array $money): int
    {
        $year = Carbon::parse($money['received_on'] ?? $agreement->created_at ?? now())->year;
        $sequence = $this->numbers[$agreement->company_id][$year] = ($this->numbers[$agreement->company_id][$year] ?? 0) + 1;
        $returnedOn = $money['returned_on'] ?? null;
        unset($money['returned_on']);

        $id = DB::table('deposits')->insertGetId([
            'company_id' => $agreement->company_id,
            'deposit_number' => sprintf('DP-%d-%04d', $year, $sequence),
            'property_id' => $propertyId,
            'client_id' => $agreement->client_id,
            'agreement_type' => $type,
            'agreement_id' => $agreement->id,
            'amount' => $amount,
            'created_by' => $agreement->created_by ?? null,
            'created_at' => now(),
            'updated_at' => now(),
            ...$money,
        ]);

        if ($returnedOn !== null) {
            $this->addSettlement($agreement, $id, $amount, $returnedOn, 'cheque', 'The deposit cheque was handed back.');
        }

        return $id;
    }

    /**
     * Record money handed back to the agreement's client.
     */
    private function addSettlement(object $agreement, int $depositId, float $amount, mixed $settledOn, string $method, string $notes): void
    {
        DB::table('settlements')->insert([
            'company_id' => $agreement->company_id,
            'settleable_type' => 'deposit',
            'settleable_id' => $depositId,
            'settled_on' => $settledOn,
            'amount' => $amount,
            'paid_to' => DB::table('clients')->where('id', $agreement->client_id)->value('name'),
            'method' => $method,
            'notes' => $notes,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('deposits')->where('id', $depositId)->update(['settled_amount' => $amount]);
    }
};
