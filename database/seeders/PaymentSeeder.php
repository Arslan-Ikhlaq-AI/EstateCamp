<?php

namespace Database\Seeders;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;

/**
 * Payments for the demo invoices, each client paying the way the notes on
 * ClientSeeder describe. Invoices from earlier months are settled; this
 * month's tell different stories: one unpaid and overdue, one half paid, one
 * covered by a cheque that has not cleared, and so on. FreshFold's September
 * cheque bounced, and Gulf Builders paid July and August in one transfer to
 * show a payment split across two invoices.
 *
 * Safe to re-run: payments are numbered in a fixed order and matched on
 * their number. Requires InvoiceSeeder.
 */
class PaymentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $thisMonth = today()->startOfMonth();
        $groups = [];

        $invoices = $company->invoices()
            ->with('client')
            ->whereNot('status', 'void')
            ->orderBy('issue_date')
            ->orderBy('invoice_number')
            ->get();

        foreach ($invoices as $invoice) {
            $plan = $this->plan($invoice, $invoice->issue_date->gte($thisMonth));

            if ($plan === null) {
                continue;
            }

            $key = $plan['group'] ?? "invoice-{$invoice->id}";
            $groups[$key] ??= ['plan' => $plan, 'client_id' => $invoice->client_id, 'allocations' => []];
            $groups[$key]['allocations'][$invoice->id] = round((float) $invoice->total * ($plan['share'] ?? 1), 2);
        }

        $sequence = [];
        $payments = [];
        $now = now();

        foreach ($groups as $key => $group) {
            $plan = $group['plan'];
            $received = $plan['received']->min(today());
            $year = $received->year;
            $sequence[$year] = ($sequence[$year] ?? 0) + 1;
            $number = sprintf('RCPT-%d-%04d', $year, $sequence[$year]);
            $isCheque = $plan['method'] === 'cheque';
            $groups[$key]['number'] = $number;

            $payments[] = [
                'company_id' => $company->id,
                'payment_number' => $number,
                'client_id' => $group['client_id'],
                'received_on' => $received->toDateString(),
                'amount' => round(array_sum($group['allocations']), 2),
                'method' => $plan['method'],
                'status' => $plan['status'],
                'reference' => $isCheque ? null : strtoupper(substr($plan['method'], 0, 4))."-{$number}",
                'cheque_number' => $isCheque ? sprintf('%06d', 700000 + $sequence[$year]) : null,
                'cheque_date' => $isCheque ? $received->toDateString() : null,
                'bank_name' => $isCheque ? $plan['bank'] : null,
                'notes' => $plan['notes'] ?? null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Bulk upserts keep the seeder quick; the unique indexes make re-runs update in place.
        Payment::query()->upsert($payments, ['company_id', 'payment_number'], [
            'client_id', 'received_on', 'amount', 'method', 'status', 'reference', 'cheque_number', 'cheque_date', 'bank_name', 'notes', 'updated_at',
        ]);

        $paymentIds = $company->payments()->pluck('id', 'payment_number');
        $allocations = [];

        foreach ($groups as $group) {
            foreach ($group['allocations'] as $invoiceId => $amount) {
                $allocations[] = [
                    'payment_id' => $paymentIds[$group['number']],
                    'invoice_id' => $invoiceId,
                    'client_id' => $group['client_id'],
                    'amount' => $amount,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        PaymentAllocation::query()->upsert($allocations, ['payment_id', 'invoice_id'], ['client_id', 'amount', 'updated_at']);

        // Only invoices with allocations can have changed; the rest stay unpaid.
        $company->invoices()
            ->whereHas('allocations')
            ->get()
            ->each(fn (Invoice $invoice) => $invoice->recalculatePaid());
    }

    /**
     * How the invoice's client paid it, or null when it is still unpaid.
     *
     * @return array{method: string, status: string, received: CarbonInterface, bank?: string, share?: float, group?: string, notes?: string}|null
     */
    private function plan(Invoice $invoice, bool $isThisMonth): ?array
    {
        $issued = $invoice->issue_date;

        return match ($invoice->client->name) {
            ClientSeeder::GULF_BUILDERS => match (true) {
                $isThisMonth => null,
                in_array($invoice->period_start->month, [7, 8], true) => [
                    'group' => "gulf-builders-jul-aug-{$issued->year}",
                    'method' => 'bank_transfer', 'status' => 'cleared',
                    'received' => $issued->copy()->setDate($issued->year, 8, 20),
                    'notes' => 'One transfer for July and August.',
                ],
                default => ['method' => 'bank_transfer', 'status' => 'cleared', 'received' => $issued->copy()->addDays(5)],
            },
            ClientSeeder::AL_NOOR => [
                'method' => 'bank_transfer', 'status' => 'cleared', 'received' => $issued->copy()->addDays(4),
                'share' => $isThisMonth ? 0.5 : 1.0,
                'notes' => $isThisMonth ? 'Part payment; the rest promised by the end of the month.' : null,
            ],
            ClientSeeder::DESERT_LINE => ['method' => 'cheque', 'status' => 'cleared', 'received' => $issued, 'bank' => 'Mashreq'],
            ClientSeeder::RAHUL => ['method' => 'cash', 'status' => 'cleared', 'received' => $issued->copy()->addDay()],
            ClientSeeder::DANIEL => [
                'method' => 'cheque', 'status' => $isThisMonth ? 'pending' : 'cleared', 'received' => $issued, 'bank' => 'First Abu Dhabi Bank',
                'notes' => $isThisMonth ? 'Post-dated cheque, not yet presented.' : null,
            ],
            ClientSeeder::AISHA => ['method' => 'bank_transfer', 'status' => 'cleared', 'received' => $issued->copy()->addDays(2)],
            ClientSeeder::MINI_MART => ['method' => 'cheque', 'status' => 'cleared', 'received' => $issued, 'bank' => 'Emirates Islamic'],
            ClientSeeder::FRESHFOLD => [
                'method' => 'cheque', 'status' => $invoice->period_start->month === 9 ? 'bounced' : 'cleared', 'received' => $issued, 'bank' => 'RAKBANK',
                'notes' => $invoice->period_start->month === 9 ? 'Returned for insufficient funds; replacement requested.' : null,
            ],
            ClientSeeder::BREW_CORNER => $isThisMonth ? null : ['method' => 'card', 'status' => 'cleared', 'received' => $issued->copy()->addDays(3)],
            default => null,
        };
    }
}
