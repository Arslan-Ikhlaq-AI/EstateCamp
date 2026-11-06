<?php

namespace Database\Seeders;

use App\Models\Commission;
use App\Models\Company;
use App\Models\Contract;
use App\Models\Deposit;
use App\Models\ExtraIncome;
use App\Models\RoomRental;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;

/**
 * The demo company's extra payments: a security deposit for every contract
 * and rental that agreed one, a commission on some of them, and extra income
 * from the providers serving the buildings. Each tells a different story:
 * paid in cash or by cheque, not paid yet, kept whole, settled in part or in
 * full.
 *
 * Safe to re-run: a commission or deposit already saved stays as it is,
 * income is matched on what it was for, and settlements are added once.
 * Requires ContractSeeder and RoomRentalSeeder.
 */
class ExtraPaymentSeeder extends Seeder
{
    /**
     * How the deposits and commissions are paid, in turn.
     */
    private const PAYMENTS = ['cheque', 'cash', 'cash', 'later'];

    /**
     * A commission on every how-manyth agreement.
     */
    private const COMMISSION_EVERY = 2;

    /**
     * The commission as a percentage of the rent.
     */
    private const COMMISSION_RATE = 5;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $admin = $company->users()->orderBy('id')->firstOrFail();

        $company->contracts()->whereIn('status', ['active', 'draft'])->orderBy('contract_number')->get()
            ->each(fn (Contract $contract, int $index) => $this->seedAgreement($contract, $index, $admin));

        $company->roomRentals()->orderBy('rental_number')->get()
            ->each(fn (RoomRental $rental, int $index) => $this->seedAgreement($rental, $index + 1, $admin));

        $this->seedExtraIncome($company, $admin);
        $this->settle($admin);
    }

    /**
     * The deposit agreed, and a commission on every other agreement. Money
     * paid arrived on the day the agreement started, or today if that is
     * still to come. A draft has been paid nothing yet.
     */
    private function seedAgreement(Contract|RoomRental $agreement, int $index, User $admin): void
    {
        $payment = $agreement->status === 'draft' ? 'later' : self::PAYMENTS[$index % count(self::PAYMENTS)];
        $cheque = fn (string $number) => ['payment' => $payment, 'cheque_number' => $number, 'bank_name' => 'Emirates NBD', 'cheque_date' => $agreement->start_date];
        $receivedOn = $agreement->start_date->min(today());

        if (! $agreement->deposit()->exists()) {
            $agreement->syncDeposit($cheque(sprintf('70%04d', $index)), $admin);
            $this->dateReceipt($agreement->deposit()->first(), $receivedOn);
        }

        if ($index % self::COMMISSION_EVERY === 0 && ! $agreement->commission()->exists()) {
            $agreement->syncCommission(['type' => 'percentage', 'rate' => self::COMMISSION_RATE, 'amount' => null, ...$cheque(sprintf('80%04d', $index))], $admin);
            $this->dateReceipt($agreement->commission()->first(), $receivedOn);
        }
    }

    private function dateReceipt(?Model $record, CarbonInterface $on): void
    {
        if ($record?->status === 'received') {
            $record->forceFill(['received_on' => $on])->save();
        }
    }

    /**
     * What the providers serving the buildings paid this month and last.
     */
    private function seedExtraIncome(Company $company, User $admin): void
    {
        $properties = $company->properties()->orderBy('code')->get();

        foreach ($this->extraIncome() as $index => $income) {
            $record = ExtraIncome::query()->firstOrNew(['company_id' => $company->id, 'title' => $income['title']]);

            if (! $record->exists) {
                $record->forceFill([
                    'income_number' => ExtraIncome::nextNumber($company->id),
                    'property_id' => $properties[$index % $properties->count()]->id,
                    'status' => 'received',
                    'created_by' => $admin->id,
                    ...$income,
                ])->save();
            }
        }
    }

    /**
     * Settle the oldest record of each kind in full and the next in part,
     * leaving the rest in hand.
     */
    private function settle(User $admin): void
    {
        foreach ([Commission::class => 'Sales agent', Deposit::class => null, ExtraIncome::class => 'Camp welfare fund'] as $model => $paidTo) {
            $records = $model::query()->where('company_id', $admin->company_id)->where('status', 'received')->orderBy('id')->limit(2)->get();

            foreach ($records as $index => $record) {
                if ($record->settlements()->exists()) {
                    continue;
                }

                $record->settle([
                    'settled_on' => today(),
                    'amount' => $index === 0 ? $record->remaining() : round($record->remaining() / 2, 2),
                    'paid_to' => $paidTo ?? $record->client->name,
                    'method' => $index === 0 ? 'bank_transfer' : 'cash',
                    'notes' => $model === Deposit::class ? 'Part of the deposit handed back to the client.' : 'Paid out as agreed.',
                ], $admin);
            }
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function extraIncome(): array
    {
        $lastMonth = today()->subMonthNoOverflow();

        return [
            ['title' => 'Internet share', 'received_from' => 'Emirates Fibre Services', 'amount' => 10000, 'received_on' => $lastMonth, 'method' => 'bank_transfer', 'invoice_number' => 'EFS-1184'],
            ['title' => 'Washing machines share', 'received_from' => 'FreshSpin Laundry', 'amount' => 4200, 'received_on' => $lastMonth, 'method' => 'cash', 'invoice_number' => 'FS-0932'],
            ['title' => 'Vending machines share', 'received_from' => 'Gulf Vending', 'amount' => 2500, 'received_on' => today(), 'method' => 'cheque', 'invoice_number' => 'GV-2210'],
        ];
    }
}
