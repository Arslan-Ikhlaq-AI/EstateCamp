<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Commission;
use App\Models\Deposit;
use App\Models\ExtraIncome;
use App\Models\Settlement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * What the extra payment pages read: what came in, what was settled and what
 * is left, and the way each record and settlement is shown.
 */
trait ReadsExtraPayments
{
    /**
     * The relations commissions and deposits are listed with.
     *
     * @return array<string, mixed>
     */
    public static function agreementMoneyRelations(): array
    {
        return [
            'property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code']),
            'client' => fn ($query) => $query->withTrashed()->select(['id', 'name']),
            'agreement' => fn ($query) => $query,
            'settlements' => fn ($query) => $query->with('createdBy:id,name')->orderBy('settled_on')->orderBy('id'),
        ];
    }

    /**
     * Keep the records received in `$period`. Money still to arrive has no
     * date yet and is owed whatever the period, so it always stays.
     *
     * @param  Builder<Commission|Deposit>  $query
     * @param  array{kind: string, from: ?string, to: ?string}  $period
     * @return Builder<Commission|Deposit>
     */
    protected function receivedIn(Builder $query, array $period): Builder
    {
        return $period['kind'] === 'all' ? $query : $query->where(fn (Builder $query) => $this->wherePeriod($query, 'received_on', $period)->orWhere('status', 'pending'));
    }

    /**
     * Pending first, as they need chasing, then the latest received.
     *
     * @param  Builder<Commission|Deposit|ExtraIncome>  $query
     * @return Builder<Commission|Deposit|ExtraIncome>
     */
    protected function inManageOrder(Builder $query): Builder
    {
        return $query->orderByRaw('case when received_on is null then 0 else 1 end')->orderByDesc('received_on')->orderByDesc('id');
    }

    /**
     * What came in and went out of `$records`: received minus settled is
     * what remains in hand. Cancelled records count for nothing.
     *
     * @param  Builder<Commission|Deposit|ExtraIncome>  $records
     * @return array{received: float, receivedCount: int, settled: float, settledCount: int, partCount: int, heldCount: int, remaining: float, toCollect: float, toCollectCount: int}
     */
    protected function moneyFigures(Builder $records): array
    {
        $row = (clone $records)->reorder()->toBase()->selectRaw(
            "coalesce(sum(case when status = 'received' then amount else 0 end), 0) as received,
            coalesce(sum(case when status = 'received' then 1 else 0 end), 0) as received_count,
            coalesce(sum(case when status = 'received' then settled_amount else 0 end), 0) as settled,
            coalesce(sum(case when status = 'received' and settled_amount >= amount then 1 else 0 end), 0) as settled_count,
            coalesce(sum(case when status = 'received' and settled_amount > 0 and settled_amount < amount then 1 else 0 end), 0) as part_count,
            coalesce(sum(case when status = 'received' and settled_amount <= 0 then 1 else 0 end), 0) as held_count,
            coalesce(sum(case when status = 'pending' then amount else 0 end), 0) as to_collect,
            coalesce(sum(case when status = 'pending' then 1 else 0 end), 0) as to_collect_count"
        )->first();

        return [
            'received' => round((float) $row->received, 2),
            'receivedCount' => (int) $row->received_count,
            'settled' => round((float) $row->settled, 2),
            'settledCount' => (int) $row->settled_count,
            'partCount' => (int) $row->part_count,
            'heldCount' => (int) $row->held_count,
            'remaining' => round((float) $row->received - (float) $row->settled, 2),
            'toCollect' => round((float) $row->to_collect, 2),
            'toCollectCount' => (int) $row->to_collect_count,
        ];
    }

    /**
     * How many of `$records` stand each way.
     *
     * @param  Builder<Commission|Deposit|ExtraIncome>  $records
     * @return Collection<string, int>
     */
    protected function standingCounts(Builder $records): Collection
    {
        $standing = $records->getModel()::standingSql();

        return (clone $records)->reorder()->toBase()
            ->selectRaw("{$standing} as value, count(*) as aggregate")
            ->groupByRaw($standing)
            ->pluck('aggregate', 'value')
            ->map(fn (mixed $aggregate) => (int) $aggregate);
    }

    /**
     * How the money in `$recordsByKind` was settled: how many settlements,
     * their total, and the latest `$limit` with the record each came out of.
     *
     * @param  array<string, Builder<Commission|Deposit|ExtraIncome>>  $recordsByKind
     * @return array{count: int, amount: float, rows: list<array<string, mixed>>}
     */
    protected function settlementHistory(array $recordsByKind, int $limit): array
    {
        $settlements = fn () => Settlement::query()->where(function (Builder $query) use ($recordsByKind) {
            foreach ($recordsByKind as $kind => $records) {
                $query->orWhere(fn (Builder $query) => $query->where('settleable_type', $kind)->whereIn('settleable_id', (clone $records)->reorder()->select('id')));
            }
        });

        return [
            'count' => $settlements()->count(),
            'amount' => round((float) $settlements()->sum('amount'), 2),
            'rows' => $settlements()
                ->with(['createdBy:id,name', 'settleable.property' => fn ($query) => $query->withTrashed()->select(['id', 'name', 'code'])])
                ->orderByDesc('settled_on')
                ->orderByDesc('id')
                ->limit($limit)
                ->get()
                ->map(fn (Settlement $settlement) => [
                    ...self::settlementDetails($settlement),
                    'kind' => $settlement->settleable_type,
                    'recordId' => $settlement->settleable_id,
                    'recordNumber' => $settlement->settleable?->getAttribute($settlement->settleable::NUMBER_COLUMN),
                    'property' => $settlement->settleable?->property?->only(['id', 'name', 'code']),
                ])
                ->all(),
        ];
    }

    /**
     * What the Manage dialog needs of any extra payment: where the money
     * stands, how it arrived and how it was settled.
     *
     * @return array<string, mixed>
     */
    public static function moneyDetails(Commission|Deposit|ExtraIncome $record, string $kind): array
    {
        return [
            'kind' => $kind,
            'id' => $record->id,
            'number' => $record->getAttribute($record::NUMBER_COLUMN),
            'amount' => (float) $record->amount,
            'settled' => (float) $record->settled_amount,
            'remaining' => $record->remaining(),
            'status' => $record->status,
            'standing' => $record->standing(),
            'receivedOn' => $record->received_on?->toDateString(),
            'method' => $record->method,
            'settlements' => $record->settlements->map(fn (Settlement $settlement) => self::settlementDetails($settlement))->values()->all(),
        ];
    }

    /**
     * One commission or deposit as the lists show it.
     *
     * @return array<string, mixed>
     */
    public static function agreementMoneyDetails(Commission|Deposit $record, string $kind): array
    {
        return [
            ...self::moneyDetails($record, $kind),
            'rate' => $record instanceof Commission && $record->rate !== null ? (float) $record->rate : null,
            'chequeNumber' => $record->cheque_number,
            'bankName' => $record->bank_name,
            'chequeDate' => $record->cheque_date?->toDateString(),
            'notes' => $record->notes,
            'client' => $record->client?->only(['id', 'name']),
            'property' => $record->property?->only(['id', 'name', 'code']),
            'agreement' => self::agreementLink($record->agreement),
        ];
    }

    /**
     * @return array{type: string, id: int, number: string}|null
     */
    public static function agreementLink(?Model $agreement): ?array
    {
        return $agreement ? [
            'type' => $agreement->getMorphClass(),
            'id' => $agreement->getKey(),
            'number' => $agreement->getAttribute($agreement::NUMBER_COLUMN),
        ] : null;
    }

    /**
     * @return array<string, mixed>
     */
    public static function settlementDetails(Settlement $settlement): array
    {
        return [
            'id' => $settlement->id,
            'settledOn' => $settlement->settled_on->toDateString(),
            'amount' => (float) $settlement->amount,
            'paidTo' => $settlement->paid_to,
            'method' => $settlement->method,
            'reference' => $settlement->reference,
            'notes' => $settlement->notes,
            'by' => $settlement->createdBy?->name,
        ];
    }
}
