import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import SignupsChart from './Partials/SignupsChart';
import StatCards from './Partials/StatCards';
import UsersTable from './Partials/UsersTable';
import VerificationChart from './Partials/VerificationChart';

const rangeOptions = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
];

// Mirrors the defaults the controller applies, so the URL only carries
// the filters that differ from them.
function buildQuery({ range, search, status, sort, direction, page }) {
    const query = {};

    if (range !== 30) query.range = range;
    if (search) query.search = search;
    if (status) query.status = status;
    if (sort !== 'created_at') query.sort = sort;
    if (direction !== 'desc') query.direction = direction;
    if (page > 1) query.page = page;

    return query;
}

export default function Dashboard({
    filters,
    stats,
    signups,
    verification,
    users,
}) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);

    const currentPage = users.current_page;

    const visit = useCallback(
        (changes, only) => {
            router.get(
                route('admin.dashboard'),
                buildQuery({ ...filters, page: currentPage, ...changes }),
                {
                    only: ['filters', ...only],
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    onStart: () => setIsLoading(true),
                    onFinish: () => setIsLoading(false),
                },
            );
        },
        [filters, currentPage],
    );

    const changeRange = (range) => visit({ range }, ['stats', 'signups']);

    const changeTableFilters = useCallback(
        (changes) => visit({ ...changes, page: 1 }, ['users']),
        [visit],
    );

    const changePage = useCallback(
        (page) => visit({ page }, ['users']),
        [visit],
    );

    return (
        <DashboardLayout>
            <Head title={t('nav.users')} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.configuration') }, { label: t('nav.users') }]}
                title={t('nav.users')}
                description="Track signups and manage everyone who can sign in."
                actions={
                    <ToggleGroup
                        aria-label="Date range"
                        variant="outline"
                        spacing={0}
                        value={[String(filters.range)]}
                        onValueChange={([value]) => {
                            if (value) {
                                changeRange(Number(value));
                            }
                        }}
                    >
                        {rangeOptions.map((option) => (
                            <ToggleGroupItem key={option.value} value={String(option.value)}>
                                {option.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                }
            />

            <div
                aria-busy={isLoading}
                className={cn(
                    'flex flex-col gap-6 transition-opacity',
                    isLoading && 'opacity-80',
                )}
            >
                <StatCards stats={stats} days={filters.range} />

                <div className="grid gap-4 lg:grid-cols-3">
                    <SignupsChart
                        className="lg:col-span-2"
                        signups={signups}
                        days={filters.range}
                    />
                    <VerificationChart verification={verification} />
                </div>
            </div>

            <UsersTable
                users={users}
                filters={filters}
                isLoading={isLoading}
                onFilterChange={changeTableFilters}
                onPageChange={changePage}
            />
        </DashboardLayout>
    );
}
