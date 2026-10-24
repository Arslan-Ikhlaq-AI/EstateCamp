<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Company;
use App\Models\Invoice;
use App\Models\RoomRental;
use Illuminate\Support\Collection;

/**
 * What clients and individual tenants owe today, aged by how long it has
 * been due: unpaid invoices from their due date, and each unpaid month of
 * an individual's rent from the day it fell due.
 */
trait AgesReceivables
{
    /**
     * How long money has been owed: not yet due, then by days past due.
     */
    public const AGING_BUCKETS = ['current', 'days_1_30', 'days_31_60', 'days_61_90', 'over_90'];

    protected function agingBucket(int $daysPastDue): string
    {
        return match (true) {
            $daysPastDue <= 0 => 'current',
            $daysPastDue <= 30 => 'days_1_30',
            $daysPastDue <= 60 => 'days_31_60',
            $daysPastDue <= 90 => 'days_61_90',
            default => 'over_90',
        };
    }

    /**
     * Every invoice with something left to pay, the one due longest ago first.
     *
     * @return Collection<int, array{id: int, number: string, kind: string, clientId: int, client: string, clientType: string, issueDate: string, dueDate: string, total: float, paid: float, balance: float, daysPastDue: int, bucket: string}>
     */
    protected function openInvoices(Company $company): Collection
    {
        return $company->invoices()
            ->whereIn('status', ['issued', 'partially_paid'])
            ->with('client:id,name,client_type')
            ->orderBy('due_date')
            ->orderBy('id')
            ->get()
            ->map(function (Invoice $invoice) {
                $days = (int) $invoice->due_date->diffInDays(today(), false);

                return [
                    'id' => $invoice->id,
                    'number' => $invoice->invoice_number,
                    'kind' => $invoice->kind,
                    'clientId' => $invoice->client_id,
                    'client' => $invoice->client->name,
                    'clientType' => $invoice->client->client_type,
                    'issueDate' => $invoice->issue_date->toDateString(),
                    'dueDate' => $invoice->due_date->toDateString(),
                    'total' => (float) $invoice->total,
                    'paid' => (float) $invoice->amount_paid,
                    'balance' => $invoice->balance(),
                    'daysPastDue' => max(0, $days),
                    'bucket' => $this->agingBucket($days),
                ];
            })
            ->filter(fn (array $invoice) => $invoice['balance'] > 0)
            ->values();
    }

    /**
     * Rent owed by individuals renting rooms, whether they still stay or
     * have moved out, the most owed first. Each unpaid month is aged from
     * the day it fell due.
     *
     * @return Collection<int, array{id: int, number: string, clientId: int, client: string, status: string, months: int, dueSince: string, daysPastDue: int, amount: float, buckets: array<string, float>}>
     */
    protected function rentArrears(Company $company): Collection
    {
        return $company->roomRentals()
            ->withSum(['payments as rent_paid' => fn ($payments) => $payments->where('status', 'cleared')->where('purpose', 'rent')], 'amount')
            ->with('client:id,name')
            ->get()
            ->map(function (RoomRental $rental) {
                $unpaid = collect($rental->unpaidRent());

                if ($unpaid->isEmpty()) {
                    return null;
                }

                $buckets = array_fill_keys(self::AGING_BUCKETS, 0.0);

                foreach ($unpaid as $month) {
                    $bucket = $this->agingBucket((int) $month['dueOn']->diffInDays(today(), false));
                    $buckets[$bucket] = round($buckets[$bucket] + $month['amount'], 2);
                }

                return [
                    'id' => $rental->id,
                    'number' => $rental->rental_number,
                    'clientId' => $rental->client_id,
                    'client' => $rental->client->name,
                    'status' => $rental->status,
                    'months' => $unpaid->count(),
                    'dueSince' => $unpaid->first()['dueOn']->toDateString(),
                    'daysPastDue' => max(0, (int) $unpaid->first()['dueOn']->diffInDays(today(), false)),
                    'amount' => round($unpaid->sum('amount'), 2),
                    'buckets' => $buckets,
                ];
            })
            ->filter()
            ->sortByDesc('amount')
            ->values();
    }

    /**
     * What is owed today: on invoices, of which overdue, and in rent.
     *
     * @return array{invoices: array{count: int, amount: float}, overdue: array{count: int, amount: float}, rent: array{count: int, amount: float}, total: float}
     */
    protected function receivableTotals(Company $company): array
    {
        $invoices = $this->openInvoices($company);
        $overdue = $invoices->where('daysPastDue', '>', 0);
        $rent = $this->rentArrears($company);

        return [
            'invoices' => ['count' => $invoices->count(), 'amount' => round($invoices->sum('balance'), 2)],
            'overdue' => ['count' => $overdue->count(), 'amount' => round($overdue->sum('balance'), 2)],
            'rent' => ['count' => $rent->count(), 'amount' => round($rent->sum('amount'), 2)],
            'total' => round($invoices->sum('balance') + $rent->sum('amount'), 2),
        ];
    }
}
