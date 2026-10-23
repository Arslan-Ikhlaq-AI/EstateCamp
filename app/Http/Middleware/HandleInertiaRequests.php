<?php

namespace App\Http\Middleware;

use App\Models\Cheque;
use App\Models\Company;
use App\Models\Contract;
use App\Models\HeadLease;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\StaffMember;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * Documents expiring within this many days raise a notification.
     */
    private const DOCUMENT_WARNING_DAYS = 60;

    /**
     * Leases and the trade license raise a notification this many days ahead.
     */
    private const CONTRACT_WARNING_DAYS = 90;

    /**
     * Cheques raise a notification this many days before their date.
     */
    private const CHEQUE_WARNING_DAYS = 7;

    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        // Queried rather than loaded as relations, so they never end up inside `auth.user`.
        $company = $user?->company_id ? Company::find($user->company_id) : null;

        $member = $user?->staffMember;
        $canUseApp = $user?->can('use-app') ?? false;

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user,
                // A staff member's sign-in shows their job.
                'role' => $user?->role()->value('name') ?? $member?->role()->value('name'),
                'company' => $company?->only(['id', 'name', 'short_name', 'logo_url']),
                // What the navigation offers: the rest of the app, the staff pages, and the user's own page.
                'access' => $user ? ['app' => $canUseApp, 'staff' => $user->staffAccess(), 'self' => $member !== null] : null,
            ],
            // The company's alerts are for those who work in the rest of the app.
            'notifications' => fn () => $company && $canUseApp ? $this->notifications($company) : [],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
            ],
        ];
    }

    /**
     * Cheques that need someone to act: bounced ones without a replacement,
     * client cheques to deposit or still to collect, and landlord cheques to
     * write or about to clear (so the account has the funds).
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function chequeNotifications(Company $company): Collection
    {
        $today = today();

        return $company->cheques()
            ->where(fn (Builder $query) => $query
                ->where(fn (Builder $query) => $query->where('status', 'bounced')->whereDoesntHave('replacement'))
                ->orWhere(fn (Builder $query) => $query->whereIn('status', ['pending', 'received'])->whereDate('cheque_date', '<=', $today->copy()->addDays(self::CHEQUE_WARNING_DAYS)))
                ->orWhere(fn (Builder $query) => $query->where('status', 'issued')->whereBetween('cheque_date', [$today, $today->copy()->addDays(self::CHEQUE_WARNING_DAYS)])))
            ->with(['chequeable' => fn (MorphTo $morph) => $morph->morphWith([
                Contract::class => ['client:id,name'],
                HeadLease::class => ['landlord:id,name'],
                RoomRental::class => ['client:id,name'],
            ])])
            ->orderBy('cheque_date')
            ->limit(30)
            ->get()
            ->filter(fn (Cheque $cheque) => $cheque->chequeable !== null)
            ->map(function (Cheque $cheque) use ($today): array {
                $agreement = $cheque->chequeable;
                $isLease = $agreement instanceof HeadLease;
                $days = (int) $today->diffInDays($cheque->status === 'bounced' ? $cheque->bounced_on : $cheque->cheque_date, false);

                $type = match ($cheque->status) {
                    'bounced' => 'cheque_bounced',
                    'received' => 'cheque_deposit_due',
                    'issued' => 'cheque_clearing',
                    default => $isLease ? 'cheque_to_write' : 'cheque_to_collect',
                };

                return [
                    'id' => "cheque-{$cheque->id}",
                    'type' => $type,
                    'severity' => match (true) {
                        $type === 'cheque_bounced', $days < 0 => 'critical',
                        $type === 'cheque_clearing' => 'info',
                        default => 'warning',
                    },
                    'title' => $cheque->cheque_number ?? "{$cheque->sequence} · ".match (true) {
                        $agreement instanceof Contract => $agreement->contract_number,
                        $agreement instanceof RoomRental => $agreement->rental_number,
                        default => $agreement->lease_number,
                    },
                    'subject' => $isLease ? $agreement->landlord?->name : $agreement->client?->name,
                    'days' => $days,
                    'url' => match (true) {
                        $agreement instanceof Contract => route('contracts.show', $agreement->id),
                        $agreement instanceof RoomRental => route('rentals.show', $agreement->id),
                        default => route('head-leases.show', $agreement->id),
                    },
                ];
            })
            ->values();
    }

    /**
     * Identity documents of staff still employed that have run out or run
     * out soon, one notification per document.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function staffDocumentNotifications(Company $company): Collection
    {
        return $company->staffMembers()
            ->current()
            ->documentsExpiring(null, today()->addDays(StaffMember::DOCUMENT_WARNING_DAYS))
            ->limit(50)
            ->get()
            ->flatMap(fn (StaffMember $member) => collect($member->identityDocuments())
                ->filter(fn (array $document) => $document['days'] !== null && $document['days'] <= StaffMember::DOCUMENT_WARNING_DAYS)
                ->map(fn (array $document): array => [
                    'id' => "staff-{$member->id}-{$document['type']}",
                    'type' => $document['days'] < 0 ? 'staff_document_expired' : 'staff_document_expiring',
                    'severity' => $document['days'] < 0 ? 'critical' : ($document['days'] <= 30 ? 'warning' : 'info'),
                    'title' => $member->full_name,
                    'subject' => $document['type'],
                    'days' => $document['days'],
                    'url' => route('staff.show', $member->id),
                ]))
            ->values();
    }

    /**
     * Things in the company that need attention, most urgent first. Each entry
     * carries data rather than a sentence so the client can word it in the
     * user's language.
     *
     * @return array<int, array{id: string, type: string, severity: string, title: string, subject: string|null, days: int|null, url: string}>
     */
    private function notifications(Company $company): array
    {
        $today = today();

        $documents = PropertyDocument::query()
            ->whereHas('property', fn (Builder $query) => $query->whereBelongsTo($company))
            ->whereNotNull('expires_on')
            ->whereDate('expires_on', '<=', $today->copy()->addDays(self::DOCUMENT_WARNING_DAYS))
            ->with('property:id,name')
            ->get()
            ->map(function (PropertyDocument $document) use ($today): array {
                $days = (int) $today->diffInDays($document->expires_on, false);

                return [
                    'id' => "document-{$document->id}",
                    'type' => $days < 0 ? 'document_expired' : 'document_expiring',
                    'severity' => $days < 0 ? 'critical' : ($days <= 30 ? 'warning' : 'info'),
                    'title' => $document->title,
                    'subject' => $document->property->name,
                    'days' => $days,
                    'url' => route('properties.show', $document->property_id),
                ];
            });

        $leases = $company->properties()
            ->where('ownership_type', 'leased')
            ->whereNotNull('lease_end_date')
            ->whereDate('lease_end_date', '<=', $today->copy()->addDays(self::CONTRACT_WARNING_DAYS))
            ->with('landlord:id,name')
            ->get()
            ->map(function (Property $property) use ($today): array {
                $days = (int) $today->diffInDays($property->lease_end_date, false);

                return [
                    'id' => "lease-{$property->id}",
                    'type' => $days < 0 ? 'lease_ended' : 'lease_ending',
                    'severity' => $days < 0 ? 'critical' : 'warning',
                    'title' => $property->name,
                    'subject' => $property->landlord?->name,
                    'days' => $days,
                    'url' => route('properties.index'),
                ];
            });

        $rooms = $company->rooms()
            ->where('status', 'under_maintenance')
            ->with('property:id,name')
            ->get()
            ->map(fn (Room $room): array => [
                'id' => "room-{$room->id}",
                'type' => 'room_maintenance',
                'severity' => 'info',
                'title' => $room->room_number,
                'subject' => $room->property->name,
                'days' => null,
                'url' => route('rooms.index', ['status' => ['under_maintenance']]),
            ]);

        $license = collect();

        if ($company->expiry_date?->lte($today->copy()->addDays(self::CONTRACT_WARNING_DAYS))) {
            $days = (int) $today->diffInDays($company->expiry_date, false);

            $license->push([
                'id' => "license-{$company->id}",
                'type' => $days < 0 ? 'license_expired' : 'license_expiring',
                'severity' => $days < 0 ? 'critical' : 'warning',
                'title' => $company->trade_license_number ?? $company->name,
                'subject' => $company->name,
                'days' => $days,
                'url' => route('configuration.company'),
            ]);
        }

        $severityOrder = ['critical' => 0, 'warning' => 1, 'info' => 2];

        return $license
            ->concat($this->chequeNotifications($company))
            ->concat($documents)
            ->concat($this->staffDocumentNotifications($company))
            ->concat($leases)
            ->concat($rooms)
            ->sortBy([
                fn (array $a, array $b) => $severityOrder[$a['severity']] <=> $severityOrder[$b['severity']],
                fn (array $a, array $b) => ($a['days'] ?? PHP_INT_MAX) <=> ($b['days'] ?? PHP_INT_MAX),
            ])
            ->values()
            ->all();
    }
}
