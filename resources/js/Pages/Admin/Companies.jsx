import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { ListEmpty } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { Building2Icon, ChevronRightIcon, LayoutGridIcon, PowerOffIcon, ToggleRightIcon, UsersRoundIcon } from 'lucide-react';
import CompanyMark from './Partials/CompanyMark';

/**
 * One company in the list: who it is, its users, how many of its pages are
 * on, and the way to its pages.
 */
function CompanyRow({ company }) {
    const { t, tOr, formatNumber } = useTranslation();
    const on = company.pages - company.disabled;

    return (
        <li>
            <Link
                href={route('admin.companies.edit', company.id)}
                className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-5 sm:px-5 lg:px-6"
            >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                    <CompanyMark company={company} />
                    <span className="flex min-w-0 flex-col">
                        <span dir="auto" className="truncate text-sm font-medium group-hover:text-brand-ink">
                            {company.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{company.email ?? company.slug}</span>
                    </span>
                </span>
                <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground tabular-nums sm:w-32">
                    <UsersRoundIcon className="size-4" />
                    {t('common.members', { count: company.users })}
                </span>
                <span className="flex flex-col gap-1.5 sm:w-40">
                    <span className="text-xs font-medium tabular-nums">
                        {company.disabled === 0 ? t('permissions.companies.allOn') : t('permissions.companies.pagesOn', { on: formatNumber(on), total: formatNumber(company.pages) })}
                    </span>
                    <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-linear-to-r from-brand-cyan to-brand-navy rtl:bg-linear-to-l" style={{ width: `${(on / company.pages) * 100}%` }} />
                    </span>
                </span>
                <span className="sm:w-24">
                    <Badge variant={company.status === 'active' ? 'success' : 'secondary'}>{tOr(`permissions.companies.statuses.${company.status}`, company.status)}</Badge>
                </span>
                <span className="flex items-center gap-1 text-[0.8125rem] font-medium text-brand-ink sm:w-24 sm:justify-end">
                    <LayoutGridIcon className="size-4" />
                    {t('permissions.companies.manage')}
                    <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </span>
            </Link>
        </li>
    );
}

/**
 * Every company on the platform with how many of its pages are on. Each
 * company's pages are switched on and off on their own page.
 */
export default function Companies({ companies }) {
    const { t, formatNumber } = useTranslation();
    const title = t('permissions.companies.title');

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.platform') }, { label: title }]} title={title} count={companies.length} description={t('permissions.companies.description')} />

            <FlashMessages />

            <section aria-label={title} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                <StatCard icon={Building2Icon} label={t('permissions.companies.stats.total')} value={formatNumber(companies.length)} detail={t('permissions.companies.stats.totalDetail')} />
                <StatCard
                    icon={ToggleRightIcon}
                    tone="success"
                    label={t('permissions.companies.stats.allOn')}
                    value={formatNumber(companies.filter((company) => company.disabled === 0).length)}
                    detail={t('permissions.companies.stats.allOnDetail')}
                />
                <StatCard
                    icon={PowerOffIcon}
                    tone="gold"
                    label={t('permissions.companies.stats.off')}
                    value={formatNumber(companies.filter((company) => company.disabled > 0).length)}
                    detail={t('permissions.companies.stats.offDetail')}
                />
            </section>

            <Card className="gap-0 overflow-hidden py-0">
                {companies.length === 0 ? (
                    <ListEmpty icon={Building2Icon} title={t('permissions.companies.empty.title')} description={t('permissions.companies.empty.description')} />
                ) : (
                    <ul className="flex flex-col divide-y">
                        {companies.map((company) => (
                            <CompanyRow key={company.id} company={company} />
                        ))}
                    </ul>
                )}
            </Card>
        </DashboardLayout>
    );
}
