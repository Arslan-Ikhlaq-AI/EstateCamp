<?php

namespace App\Http\Controllers;

use App\Models\Cheque;
use App\Models\Company;
use App\Models\Contract;
use App\Models\Invoice;
use App\Models\Occupancy;
use App\Models\Payment;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Documents expiring within this many days count as "expiring soon".
     */
    public const EXPIRY_WARNING_DAYS = 60;

    /**
     * How many months, up to and including this one, the collections trend covers.
     */
    public const TREND_MONTHS = 6;

    /**
     * How many events the recent activity feed shows.
     */
    public const ACTIVITY_ITEMS = 10;

    /**
     * How many clients the "most owed" list shows.
     */
    public const TOP_DEBTORS = 5;

    /**
     * How many months ahead, from this one, the cheque forecast covers.
     */
    public const CHEQUE_FORECAST_MONTHS = 12;

    /**
     * How many days ahead the "coming up" cheque list looks.
     */
    public const CHEQUE_LOOKAHEAD_DAYS = 14;

    /**
     * Show the operations overview for the signed-in user's company.
     */
    public function __invoke(Request $request): Response
    {
        // Queried directly so the company is not cached on the shared `auth.user` prop.
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('Dashboard', ['company' => null]);
        }

        $properties = $company->properties()
            ->with('propertyType:id,name,slug')
            ->orderBy('name')
            ->get();

        $rooms = $company->rooms()
            ->with([
                'property:id,name,code',
                'roomType:id,name,slug',
                'attachments' => fn ($query) => $query->where('is_primary', true),
            ])
            ->orderBy('property_id')
            ->orderBy('room_number')
            ->get();

        $documents = PropertyDocument::query()
            ->whereIn('property_id', $properties->modelKeys())
            ->with('property:id,name')
            ->get()
            ->sortBy(fn (PropertyDocument $document) => $document->expires_on?->timestamp ?? PHP_INT_MAX)
            ->values();

        return Inertia::render('Dashboard', [
            'company' => $this->companyDetails($company),
            'summary' => [
                'properties' => $properties->count(),
                'rooms' => $rooms->count(),
                'roomsUnderMaintenance' => $rooms->where('status', 'under_maintenance')->count(),
                'beds' => $this->beds($rooms),
                'rentRoll' => $this->rentRoll($rooms),
                'potentialRent' => $this->potentialRent($rooms),
                'documents' => [
                    'total' => $documents->count(),
                    'expiring' => $documents->filter(fn (PropertyDocument $document) => $this->documentStatus($document) === 'expiring')->count(),
                    'expired' => $documents->filter(fn (PropertyDocument $document) => $this->documentStatus($document) === 'expired')->count(),
                ],
            ],
            'properties' => $properties->map(fn (Property $property) => $this->propertyDetails(
                $property,
                $rooms->where('property_id', $property->id),
            )),
            'roomTypes' => $rooms
                ->groupBy('room_type_id')
                ->map(fn (Collection $typeRooms) => [
                    'slug' => $typeRooms->first()->roomType->slug,
                    'name' => $typeRooms->first()->roomType->name,
                    'rooms' => $typeRooms->count(),
                    'beds' => $this->beds($typeRooms),
                ])
                ->sortByDesc('beds.total')
                ->values(),
            'finance' => $this->finance($company),
            'cheques' => $this->cheques($company),
            'occupancyTrend' => $this->occupancyTrend($company),
            'activity' => $this->recentActivity($company),
            'rooms' => $rooms->map(fn (Room $room) => $this->roomDetails($room)),
            'documents' => $documents->map(fn (PropertyDocument $document) => $this->documentDetails($document)),
            'team' => $company->users()
                ->with('role:id,name')
                ->orderBy('name')
                ->get()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role?->name,
                ]),
        ]);
    }

    /**
     * Beds split into occupied, available (free beds in active rooms) and out
     * of service (free beds in rooms under maintenance or inactive).
     *
     * @param  Collection<int, Room>  $rooms
     * @return array{total: int, occupied: int, available: int, outOfService: int, occupancyRate: float|null}
     */
    private function beds(Collection $rooms): array
    {
        $total = (int) $rooms->sum('capacity');
        $occupied = (int) $rooms->sum('occupied_count');
        $available = (int) $rooms->sum(fn (Room $room) => $this->availableBeds($room));
        $inService = $occupied + $available;

        return [
            'total' => $total,
            'occupied' => $occupied,
            'available' => $available,
            'outOfService' => $total - $inService,
            'occupancyRate' => $inService > 0 ? round($occupied / $inService * 100, 1) : null,
        ];
    }

    private function availableBeds(Room $room): int
    {
        return $room->status === 'active' ? $room->capacity - $room->occupied_count : 0;
    }

    /**
     * Monthly rent currently billed: occupied beds at their room's bed rate.
     *
     * @param  Collection<int, Room>  $rooms
     */
    private function rentRoll(Collection $rooms): float
    {
        return (float) $rooms->sum(fn (Room $room) => $room->occupied_count * (float) $room->rent_per_bed);
    }

    /**
     * Monthly rent if every bed in service were let.
     *
     * @param  Collection<int, Room>  $rooms
     */
    private function potentialRent(Collection $rooms): float
    {
        return (float) $rooms->sum(fn (Room $room) => ($room->occupied_count + $this->availableBeds($room)) * (float) $room->rent_per_bed);
    }

    /**
     * Money in and money owed, worked out as on the invoices page: what was
     * collected and invoiced this month, what clients still owe and how much
     * of it is overdue, both monthly totals over the trend window, invoices
     * by where they stand, how collections were paid, and who owes most.
     *
     * @return array{collectedThisMonth: float, invoicedThisMonth: float, outstanding: float, overdue: array{count: int, amount: float}, trend: list<array{month: string, invoiced: float, collected: float}>, invoiceStatus: array{paid: int, awaiting: int, partial: int, overdue: int}, paymentMethods: list<array{method: string, amount: float}>, topDebtors: list<array{id: int, name: string, balance: float, overdue: float}>}
     */
    private function finance(Company $company): array
    {
        $open = fn () => $company->invoices()->whereIn('status', ['issued', 'partially_paid']);
        $overdue = fn () => $open()->whereDate('due_date', '<', today());
        $start = today()->startOfMonth()->subMonths(self::TREND_MONTHS - 1);

        $invoiced = $company->invoices()
            ->whereNot('status', 'void')
            ->whereDate('issue_date', '>=', $start)
            ->get(['issue_date', 'total'])
            ->groupBy(fn (Invoice $invoice) => $invoice->issue_date->format('Y-m'))
            ->map(fn (Collection $invoices) => (float) $invoices->sum('total'));

        $cleared = $company->payments()
            ->where('status', 'cleared')
            ->whereDate('received_on', '>=', $start)
            ->get(['received_on', 'amount', 'method']);

        $collected = $cleared
            ->groupBy(fn (Payment $payment) => $payment->received_on->format('Y-m'))
            ->map(fn (Collection $payments) => (float) $payments->sum('amount'));

        $trend = collect(range(0, self::TREND_MONTHS - 1))
            ->map(function (int $offset) use ($start, $invoiced, $collected) {
                $month = $start->copy()->addMonths($offset)->format('Y-m');

                return [
                    'month' => $month,
                    'invoiced' => round($invoiced->get($month, 0), 2),
                    'collected' => round($collected->get($month, 0), 2),
                ];
            })
            ->all();

        return [
            'collectedThisMonth' => end($trend)['collected'],
            'invoicedThisMonth' => end($trend)['invoiced'],
            'outstanding' => round((float) $open()->sum(DB::raw('total - amount_paid')), 2),
            'overdue' => [
                'count' => $overdue()->count(),
                'amount' => round((float) $overdue()->sum(DB::raw('total - amount_paid')), 2),
            ],
            'trend' => $trend,
            'invoiceStatus' => $this->invoiceStatus($company),
            'paymentMethods' => $cleared
                ->groupBy('method')
                ->map(fn (Collection $payments, string $method) => ['method' => $method, 'amount' => round((float) $payments->sum('amount'), 2)])
                ->sortByDesc('amount')
                ->values()
                ->all(),
            'topDebtors' => $this->topDebtors($company),
        ];
    }

    /**
     * Cheques at a glance: the register's headline figures, what comes up in
     * the next two weeks (and anything overdue or bounced), and a forecast of
     * money in and out by month from cheque dates.
     *
     * @return array<string, mixed>
     */
    private function cheques(Company $company): array
    {
        $today = today();
        $start = $today->copy()->startOfMonth();
        $end = $start->copy()->addMonths(self::CHEQUE_FORECAST_MONTHS)->subDay();

        $byMonth = $company->cheques()
            ->whereNotIn('status', ['bounced', 'returned', 'cancelled'])
            ->whereBetween('cheque_date', [$start, $end])
            ->get(['direction', 'cheque_date', 'amount'])
            ->groupBy(fn (Cheque $cheque) => $cheque->cheque_date->format('Y-m'));

        $upcoming = $company->cheques()
            ->where(fn ($query) => $query
                ->where(fn ($query) => $query->open()->whereDate('cheque_date', '<=', $today->copy()->addDays(self::CHEQUE_LOOKAHEAD_DAYS)))
                ->orWhere(fn ($query) => $query->where('status', 'bounced')->whereDoesntHave('replacement')))
            ->whereNot('status', 'deposited')
            ->with(ChequeController::detailRelations())
            ->orderByRaw("case when status = 'bounced' then 0 else 1 end")
            ->orderBy('cheque_date')
            ->limit(8)
            ->get();

        return [
            'summary' => ChequeController::summary($company),
            'upcoming' => $upcoming->map(fn (Cheque $cheque) => ChequeController::details($cheque))->all(),
            'forecast' => collect(range(0, self::CHEQUE_FORECAST_MONTHS - 1))
                ->map(function (int $offset) use ($start, $byMonth) {
                    $month = $start->copy()->addMonths($offset)->format('Y-m');
                    $cheques = $byMonth->get($month, collect());

                    return [
                        'month' => $month,
                        'incoming' => round((float) $cheques->where('direction', 'received')->sum('amount'), 2),
                        'outgoing' => round((float) $cheques->where('direction', 'issued')->sum('amount'), 2),
                    ];
                })
                ->all(),
        ];
    }

    /**
     * Invoices that are not void, by where they stand: paid, awaiting
     * payment, partly paid, or past their due date and still unpaid.
     *
     * @return array{paid: int, awaiting: int, partial: int, overdue: int}
     */
    private function invoiceStatus(Company $company): array
    {
        $invoices = $company->invoices()->whereNot('status', 'void')->get(['status', 'due_date']);
        $isOverdue = fn (Invoice $invoice) => $invoice->status !== 'paid' && $invoice->due_date->isBefore(today());

        return [
            'paid' => $invoices->where('status', 'paid')->count(),
            'awaiting' => $invoices->filter(fn (Invoice $invoice) => $invoice->status === 'issued' && ! $isOverdue($invoice))->count(),
            'partial' => $invoices->filter(fn (Invoice $invoice) => $invoice->status === 'partially_paid' && ! $isOverdue($invoice))->count(),
            'overdue' => $invoices->filter($isOverdue)->count(),
        ];
    }

    /**
     * The clients with the most left to pay on open invoices, and how much of
     * that is overdue.
     *
     * @return list<array{id: int, name: string, balance: float, overdue: float}>
     */
    private function topDebtors(Company $company): array
    {
        return $company->invoices()
            ->whereIn('status', ['issued', 'partially_paid'])
            ->with('client:id,name')
            ->get(['id', 'client_id', 'total', 'amount_paid', 'due_date'])
            ->groupBy('client_id')
            ->map(fn (Collection $invoices) => [
                'id' => $invoices->first()->client->id,
                'name' => $invoices->first()->client->name,
                'balance' => round((float) $invoices->sum(fn (Invoice $invoice) => $invoice->total - $invoice->amount_paid), 2),
                'overdue' => round((float) $invoices
                    ->filter(fn (Invoice $invoice) => $invoice->due_date->isBefore(today()))
                    ->sum(fn (Invoice $invoice) => $invoice->total - $invoice->amount_paid), 2),
            ])
            ->filter(fn (array $client) => $client['balance'] > 0)
            ->sortByDesc('balance')
            ->take(self::TOP_DEBTORS)
            ->values()
            ->all();
    }

    /**
     * People staying at the end of each month in the trend window (today, for
     * this month), from check-in and check-out dates.
     *
     * @return list<array{month: string, staying: int}>
     */
    private function occupancyTrend(Company $company): array
    {
        $start = today()->startOfMonth()->subMonths(self::TREND_MONTHS - 1);

        return collect(range(0, self::TREND_MONTHS - 1))
            ->map(function (int $offset) use ($company, $start) {
                $month = $start->copy()->addMonths($offset);
                $on = $month->isSameMonth(today()) ? today() : $month->copy()->endOfMonth();

                return ['month' => $month->format('Y-m'), 'staying' => $company->occupancies()->current($on)->count()];
            })
            ->all();
    }

    /**
     * The latest things that happened, newest first: payments received,
     * invoices issued, check-ins, check-outs and contracts signed. Events
     * dated in the future (such as a booked check-in) wait until their day.
     *
     * @return list<array{id: string, type: string, date: string, subject: string, reference: string|null, room: string|null, bed: string|null, amount: float|null, status: string|null, url: string}>
     */
    private function recentActivity(Company $company): array
    {
        $event = fn (array $values) => [
            'reference' => null,
            'room' => null,
            'bed' => null,
            'amount' => null,
            'status' => null,
            ...$values,
        ];

        $payments = $company->payments()
            ->with('client:id,name')
            ->whereDate('received_on', '<=', today())
            ->latest('received_on')
            ->latest('id')
            ->limit(self::ACTIVITY_ITEMS)
            ->get()
            ->map(fn (Payment $payment) => $event([
                'id' => "payment-{$payment->id}",
                'type' => 'payment',
                'date' => $payment->received_on->toDateString(),
                'subject' => $payment->client->name,
                'reference' => $payment->payment_number,
                'amount' => (float) $payment->amount,
                'status' => $payment->status,
                'url' => route('payments.show', $payment),
            ]));

        $invoices = $company->invoices()
            ->with('client:id,name')
            ->whereNot('status', 'void')
            ->whereDate('issue_date', '<=', today())
            ->latest('issue_date')
            ->latest('id')
            ->limit(self::ACTIVITY_ITEMS)
            ->get()
            ->map(fn (Invoice $invoice) => $event([
                'id' => "invoice-{$invoice->id}",
                'type' => 'invoice',
                'date' => $invoice->issue_date->toDateString(),
                'subject' => $invoice->client->name,
                'reference' => $invoice->invoice_number,
                'amount' => (float) $invoice->total,
                'url' => route('invoices.show', $invoice),
            ]));

        $stays = fn (string $column, string $type) => $company->occupancies()
            ->with(['occupant:id,full_name', 'bed:id,room_id,label', 'bed.room:id,room_number'])
            ->whereNotNull($column)
            ->whereDate($column, '<=', today())
            ->latest($column)
            ->latest('id')
            ->limit(self::ACTIVITY_ITEMS)
            ->get()
            ->map(fn (Occupancy $occupancy) => $event([
                'id' => "{$type}-{$occupancy->id}",
                'type' => $type,
                'date' => $occupancy->{$column}->toDateString(),
                'subject' => $occupancy->occupant->full_name,
                'room' => $occupancy->bed->room->room_number,
                'bed' => $occupancy->bed->label,
                'url' => route('occupants.show', $occupancy->occupant_id),
            ]));

        $contracts = $company->contracts()
            ->with('client:id,name')
            ->whereNotNull('signed_on')
            ->whereDate('signed_on', '<=', today())
            ->latest('signed_on')
            ->latest('id')
            ->limit(self::ACTIVITY_ITEMS)
            ->get()
            ->map(fn (Contract $contract) => $event([
                'id' => "contract-{$contract->id}",
                'type' => 'contract',
                'date' => $contract->signed_on->toDateString(),
                'subject' => $contract->client->name,
                'reference' => $contract->contract_number,
                'url' => route('contracts.show', $contract),
            ]));

        return $payments
            ->concat($invoices)
            ->concat($stays('check_in_date', 'check_in'))
            ->concat($stays('check_out_date', 'check_out'))
            ->concat($contracts)
            ->sort(fn (array $first, array $second) => strcmp($second['date'], $first['date']))
            ->take(self::ACTIVITY_ITEMS)
            ->values()
            ->all();
    }

    private function documentStatus(PropertyDocument $document): string
    {
        return match (true) {
            $document->expires_on === null => 'no_expiry',
            $document->expires_on->isBefore(today()) => 'expired',
            $document->expires_on->lte(today()->addDays(self::EXPIRY_WARNING_DAYS)) => 'expiring',
            default => 'valid',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function companyDetails(Company $company): array
    {
        return [
            'name' => $company->name,
            'legalName' => $company->legal_name,
            'shortName' => $company->short_name,
            'logoUrl' => $company->logo_url,
            'tradeLicenseNumber' => $company->trade_license_number,
            'taxRegistrationNumber' => $company->tax_registration_number,
            'licenseExpiresOn' => $company->expiry_date?->toDateString(),
            'currency' => $company->default_currency,
            'timezone' => $company->timezone,
            'city' => $company->city,
            'countryCode' => $company->country_code,
            'email' => $company->email,
            'phone' => $company->phone,
        ];
    }

    /**
     * @param  Collection<int, Room>  $rooms
     * @return array<string, mixed>
     */
    private function propertyDetails(Property $property, Collection $rooms): array
    {
        return [
            'id' => $property->id,
            'name' => $property->name,
            'code' => $property->code,
            'type' => $property->propertyType?->name,
            'typeSlug' => $property->propertyType?->slug,
            'area' => $property->area,
            'city' => $property->city,
            'coverImageUrl' => $property->cover_image_url,
            'status' => $property->status,
            'ownership' => $property->ownership_type,
            'leaseEndsOn' => $property->lease_end_date?->toDateString(),
            'rooms' => $rooms->count(),
            'beds' => $this->beds($rooms),
            'rentRoll' => $this->rentRoll($rooms),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function roomDetails(Room $room): array
    {
        $photo = $room->attachments->first();

        return [
            'id' => $room->id,
            'number' => $room->room_number,
            'block' => $room->block,
            'floor' => $room->floor_number,
            'property' => $room->property->name,
            'propertyCode' => $room->property->code,
            'type' => $room->roomType->name,
            'typeSlug' => $room->roomType->slug,
            'genderPolicy' => $room->gender_policy,
            'capacity' => $room->capacity,
            'occupied' => $room->occupied_count,
            'rentPerBed' => $room->rent_per_bed === null ? null : (float) $room->rent_per_bed,
            'status' => $room->status,
            'photoUrl' => $photo?->thumbnail_url ?? $photo?->file_url,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function documentDetails(PropertyDocument $document): array
    {
        return [
            'id' => $document->id,
            'type' => $document->document_type,
            'title' => $document->title,
            'number' => $document->document_number,
            'property' => $document->property->name,
            'propertyId' => $document->property_id,
            'expiresOn' => $document->expires_on?->toDateString(),
            'daysLeft' => $document->expires_on === null ? null : (int) today()->diffInDays($document->expires_on, false),
            'status' => $this->documentStatus($document),
        ];
    }
}
