<?php

namespace Database\Seeders;

use App\Models\Cheque;
use App\Models\Contract;
use App\Models\Invoice;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * Each demo contract's cheques, one per billing period plus the security
 * deposit. The client has handed over the cheques for the contract year
 * running today (and every earlier one), each with a photo:
 *
 * - a cheque whose period's invoice is paid has cleared;
 * - the first cheque found for an unpaid, overdue invoice bounced;
 * - other cheques dated up to today are in hand, due for deposit.
 *
 * Later years' cheques are still to be collected. Safe to re-run: a
 * schedule with cleared cheques is never rebuilt, and only cheques not yet
 * presented are touched. Requires PaymentSeeder.
 */
class ChequeSeeder extends Seeder
{
    /**
     * Banks the demo clients' cheques are drawn on.
     */
    private const BANKS = ['Emirates NBD', 'Abu Dhabi Commercial Bank', 'First Abu Dhabi Bank', 'Mashreq', 'Dubai Islamic Bank', 'RAKBANK'];

    private const DEMO_PHOTO = 'images/demo/cheque-front.svg';

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $contracts = CompanySeeder::demoCompany()->contracts()
            ->whereIn('status', ['draft', 'active'])
            ->with('client:id,name')
            ->orderBy('contract_number')
            ->get();
        $hasBounced = false;

        foreach ($contracts as $index => $contract) {
            $contract->syncCheques();
            $hasBounced = $this->collectCheques($contract, self::BANKS[$index % count(self::BANKS)], $hasBounced);
        }
    }

    /**
     * Give a cheque the demo photo of a cheque's front, as if photographed.
     */
    public static function attachDemoPhoto(Cheque $cheque): void
    {
        if ($cheque->front_image_path) {
            return;
        }

        $path = "cheques/{$cheque->company_id}/{$cheque->id}/front-demo.svg";
        Storage::disk(Cheque::IMAGE_DISK)->put($path, file_get_contents(public_path(self::DEMO_PHOTO)));
        $cheque->forceFill(['front_image_path' => $path])->save();
    }

    /**
     * Record the cheques due by the end of the contract year running today,
     * then settle, bounce or hold each one dated up to today. Returns whether
     * a bounced cheque exists by the end.
     */
    private function collectCheques(Contract $contract, string $bank, bool $hasBounced): bool
    {
        [, $yearEnd] = $contract->currentChequeYear();
        $invoices = $contract->invoices()->whereNot('status', 'void')->get();
        $contractNumber = (int) substr($contract->contract_number, -4);

        $cheques = $contract->cheques()
            ->whereNull('replaces_id')
            ->whereDate('cheque_date', '<=', $yearEnd)
            ->orderBy('cheque_date')
            ->get()
            ->filter(fn (Cheque $cheque) => $cheque->isEditable());

        foreach ($cheques as $cheque) {
            $cheque->applyEntry([
                'cheque_number' => sprintf('%06d', 200000 + $contractNumber * 1000 + ($cheque->purpose === 'rent' ? $cheque->sequence : 0)),
                'bank_name' => $bank,
                'account_holder' => $contract->client->name,
            ]);
            self::attachDemoPhoto($cheque);

            if ($cheque->cheque_date->gt(today()) || $contract->status !== 'active') {
                continue;
            }

            $invoice = $cheque->purpose === 'security_deposit'
                ? $invoices->sortBy('period_start')->first()
                : $invoices->first(fn (Invoice $invoice) => $invoice->period_start->equalTo($cheque->period_start));

            if ($invoice?->status === 'paid') {
                // Paid in the demo data already, so the cheque is marked cleared without a second payment.
                $cheque->forceFill(['status' => 'cleared', 'deposited_on' => $cheque->cheque_date, 'cleared_on' => $cheque->cheque_date])->save();
            } elseif (! $hasBounced && $invoice && $invoice->status !== 'paid' && $invoice->due_date->lt(today())) {
                $cheque->forceFill(['status' => 'deposited', 'deposited_on' => $cheque->cheque_date])->save();
                $cheque->bounce($cheque->cheque_date->copy()->addDays(2)->min(today()), 'Insufficient funds');
                $hasBounced = true;
            }
        }

        return $hasBounced;
    }
}
