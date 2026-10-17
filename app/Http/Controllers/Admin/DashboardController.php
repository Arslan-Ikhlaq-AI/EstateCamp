<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DashboardRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * The number of users shown per page in the users table.
     */
    private const USERS_PER_PAGE = 10;

    /**
     * Display the admin dashboard.
     *
     * Every data prop is a closure so that filtering the users table only
     * recomputes the data a partial reload asks for.
     */
    public function __invoke(DashboardRequest $request): Response
    {
        return Inertia::render('Admin/Dashboard', [
            'filters' => [
                'range' => $request->rangeDays(),
                'search' => $request->searchTerm(),
                'status' => $request->verificationStatus(),
                'sort' => $request->sortColumn(),
                'direction' => $request->sortDirection(),
            ],
            'stats' => fn () => $this->stats($request->rangeDays()),
            'signups' => fn () => $this->signups($request->rangeDays()),
            'verification' => fn () => $this->verification(),
            'users' => fn () => $this->users($request),
        ]);
    }

    /**
     * Build the headline numbers, comparing the selected range with the
     * range of the same length that came right before it.
     *
     * @return array{
     *     totalUsers: int,
     *     newUsers: array{value: int, previous: int, change: float|null},
     *     verifiedUsers: array{value: int, rate: float|null},
     *     unverifiedUsers: int,
     * }
     */
    private function stats(int $days): array
    {
        $currentStart = now()->subDays($days - 1)->startOfDay();
        $previousStart = $currentStart->copy()->subDays($days);

        $total = User::count();
        $verified = User::whereNotNull('email_verified_at')->count();
        $new = User::where('created_at', '>=', $currentStart)->count();
        $previous = User::where('created_at', '>=', $previousStart)
            ->where('created_at', '<', $currentStart)
            ->count();

        return [
            'totalUsers' => $total,
            'newUsers' => [
                'value' => $new,
                'previous' => $previous,
                'change' => $previous > 0 ? round(($new - $previous) / $previous * 100, 1) : null,
            ],
            'verifiedUsers' => [
                'value' => $verified,
                'rate' => $total > 0 ? round($verified / $total * 100, 1) : null,
            ],
            'unverifiedUsers' => $total - $verified,
        ];
    }

    /**
     * Build one entry per day in the range, with zeros for quiet days so the
     * chart axis stays continuous.
     *
     * @return list<array{date: string, verified: int, unverified: int}>
     */
    private function signups(int $days): array
    {
        $start = now()->subDays($days - 1)->startOfDay();

        $countsByDay = User::query()
            ->where('created_at', '>=', $start)
            ->selectRaw('date(created_at) as day')
            ->selectRaw('count(*) as total')
            ->selectRaw('sum(case when email_verified_at is not null then 1 else 0 end) as verified')
            ->groupBy('day')
            ->get()
            ->keyBy('day');

        return collect(range(0, $days - 1))
            ->map(function (int $offset) use ($start, $countsByDay): array {
                $day = $start->copy()->addDays($offset)->toDateString();
                $counts = $countsByDay->get($day);

                $total = (int) ($counts?->total ?? 0);
                $verified = (int) ($counts?->verified ?? 0);

                return [
                    'date' => $day,
                    'verified' => $verified,
                    'unverified' => $total - $verified,
                ];
            })
            ->all();
    }

    /**
     * Split every user into verified and unverified.
     *
     * @return list<array{status: string, users: int}>
     */
    private function verification(): array
    {
        $total = User::count();
        $verified = User::whereNotNull('email_verified_at')->count();

        return [
            ['status' => 'verified', 'users' => $verified],
            ['status' => 'unverified', 'users' => $total - $verified],
        ];
    }

    /**
     * Search, filter, sort and paginate the users table.
     *
     * The sort column and direction are validated against an allow-list in
     * the form request before they reach the query.
     */
    private function users(DashboardRequest $request): LengthAwarePaginator
    {
        $search = $request->searchTerm();
        $status = $request->verificationStatus();

        return User::query()
            ->when($search !== '', fn (Builder $query) => $query->where(
                fn (Builder $query) => $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
            ))
            ->when($status === 'verified', fn (Builder $query) => $query->whereNotNull('email_verified_at'))
            ->when($status === 'unverified', fn (Builder $query) => $query->whereNull('email_verified_at'))
            ->orderBy($request->sortColumn(), $request->sortDirection())
            ->orderBy('id', $request->sortDirection())
            ->paginate(self::USERS_PER_PAGE)
            ->withQueryString()
            ->through(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'isAdmin' => $user->is_admin,
                'emailVerifiedAt' => $user->email_verified_at?->toIso8601String(),
                'createdAt' => $user->created_at?->toIso8601String(),
            ]);
    }
}
