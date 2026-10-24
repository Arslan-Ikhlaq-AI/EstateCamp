import { amcNavTitle, amcRoute, CertificateBadge, ContractStateBadge } from '@/Components/AmcBadges';
import DataTable from '@/Components/DataTable';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import RowActions from '@/Components/RowActions';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { daysFromToday, useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    BanknoteIcon,
    Building2Icon,
    CalendarCheckIcon,
    CalendarClockIcon,
    CircleCheckIcon,
    CirclePauseIcon,
    CircleXIcon,
    EyeIcon,
    FileClockIcon,
    FileSignatureIcon,
    PencilIcon,
    PlusIcon,
    RefreshCwIcon,
    ShieldAlertIcon,
    ShieldCheckIcon,
} from 'lucide-react';

const STATE_ICONS = { upcoming: FileClockIcon, active: CircleCheckIcon, expiring: CalendarClockIcon, expired: CirclePauseIcon, cancelled: CircleXIcon };

// The uncovered properties offered as quick "add" buttons before the rest are summed up.
const UNCOVERED_SHOWN = 6;

/**
 * Properties with no running contract of this kind, each a shortcut to add one.
 */
function UncoveredProperties({ service, properties }) {
    const { t } = useTranslation();

    return (
        <section className="flex flex-col gap-4 rounded-xl bg-warning/[0.06] p-4 ring-1 ring-warning/25 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning">
                    <ShieldAlertIcon className="size-5" />
                </span>
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-[0.9375rem] font-semibold">{t('amcs.uncovered.title', { count: properties.length })}</h2>
                    <p className="text-[0.8125rem] text-pretty text-muted-foreground">{t('amcs.uncovered.description')}</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {properties.slice(0, UNCOVERED_SHOWN).map((property) => (
                    <Button key={property.id} variant="outline" size="sm" nativeButton={false} render={<Link href={route(amcRoute(service, 'create'), { property: property.id })} />}>
                        <PlusIcon data-icon="inline-start" />
                        <span dir="auto">{property.name}</span>
                    </Button>
                ))}
                {properties.length > UNCOVERED_SHOWN && (
                    <span className="text-[0.8125rem] text-muted-foreground">{t('amcs.uncovered.more', { count: properties.length - UNCOVERED_SHOWN })}</span>
                )}
            </div>
        </section>
    );
}

/**
 * The contracts of one kind (such as fire safety): headline figures, the
 * properties left without cover, and the searchable list.
 */
export default function Index({ service, company, filters, facets, summary, contracts }) {
    const { t, formatNumber, formatCurrency, formatDate } = useTranslation();
    const { period } = useLeasingFormat();
    const title = t(`amcs.services.${service}.title`);

    const addButton = (
        <Button nativeButton={false} render={<Link href={route(amcRoute(service, 'create'))} />}>
            <PlusIcon data-icon="inline-start" />
            {t(`amcs.services.${service}.add`)}
        </Button>
    );

    const termNote = (contract) => {
        switch (contract.state) {
            case 'upcoming':
                return <span className="text-xs text-muted-foreground">{t('amcs.startsIn', { count: daysFromToday(contract.startDate) })}</span>;
            case 'active':
            case 'expiring':
                return (
                    <span className={cn('text-xs', contract.state === 'expiring' ? 'font-medium text-warning' : 'text-muted-foreground')}>
                        {t('amcs.daysLeft', { count: contract.daysLeft })}
                    </span>
                );
            case 'expired':
                return <span className="text-xs text-muted-foreground">{t('amcs.endedOn', { date: formatDate(contract.endDate) })}</span>;
            default:
                return null;
        }
    };

    const columns = [
        {
            id: 'contract',
            header: t('amcs.columns.contract'),
            cell: (contract) => (
                <div className="flex flex-col">
                    <Link href={route(amcRoute(service, 'show'), contract.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                        {contract.number}
                    </Link>
                    <span className="text-xs text-muted-foreground">{contract.reference || '—'}</span>
                </div>
            ),
        },
        {
            id: 'property',
            header: t('amcs.columns.propertyContractor'),
            cell: (contract) => (
                <div className="flex max-w-64 flex-col">
                    <span dir="auto" className="truncate">{contract.property?.name ?? '—'}</span>
                    <span dir="auto" className="truncate text-xs text-muted-foreground">{contract.vendor}</span>
                </div>
            ),
        },
        {
            id: 'term',
            header: t('amcs.columns.term'),
            cell: (contract) => (
                <div className="flex flex-col text-sm">
                    <span className="whitespace-nowrap">{period(contract.startDate, contract.endDate)}</span>
                    {termNote(contract)}
                </div>
            ),
        },
        {
            id: 'value',
            header: t('amcs.columns.value'),
            align: 'end',
            cell: (contract) => (
                <div className="flex flex-col items-end">
                    <span className="font-medium tabular-nums">{formatCurrency(contract.value, company.currency)}</span>
                    <span className="text-xs text-muted-foreground">{t(`amcs.paymentTerms.${contract.paymentTerms}`)}</span>
                </div>
            ),
        },
        {
            id: 'nextVisit',
            header: t('amcs.columns.nextVisit'),
            cell: (contract) =>
                contract.nextVisitOn ? (
                    <div className="flex flex-col text-sm">
                        <span className="tabular-nums">{formatDate(contract.nextVisitOn)}</span>
                        {daysFromToday(contract.nextVisitOn) < 0 && <span className="text-xs font-medium text-warning">{t('amcs.overdue')}</span>}
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            id: 'certificate',
            header: t('amcs.columns.certificate'),
            cell: (contract) =>
                contract.certificate.expiresOn ? (
                    <div className="flex flex-col items-start gap-1 text-sm">
                        <span className="tabular-nums">{formatDate(contract.certificate.expiresOn)}</span>
                        {contract.certificate.state !== 'valid' && <CertificateBadge state={contract.certificate.state} />}
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        { id: 'status', header: t('amcs.columns.status'), cell: (contract) => <ContractStateBadge state={contract.state} /> },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.contractsMenu') }, { label: t(amcNavTitle(service)) }]}
                title={title}
                count={contracts?.total}
                description={t(`amcs.services.${service}.description`)}
                actions={company && addButton}
            />

            <FlashMessages />

            {company === null ? (
                <NoCompany icon={FileSignatureIcon} />
            ) : (
                <>
                    <section aria-label={t('amcs.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={ShieldCheckIcon}
                            tone="success"
                            label={t('amcs.stats.running')}
                            value={formatNumber(summary.running)}
                            meter={summary.properties > 0 ? (summary.covered / summary.properties) * 100 : undefined}
                            detail={t('amcs.stats.coveredDetail', { covered: summary.covered, total: summary.properties })}
                        />
                        <StatCard
                            icon={BanknoteIcon}
                            label={t('amcs.stats.value')}
                            value={formatCurrency(summary.value, company.currency)}
                            detail={t('amcs.stats.valueDetail')}
                        />
                        <StatCard
                            icon={CalendarClockIcon}
                            tone={summary.renewalsDue > 0 ? 'warning' : 'primary'}
                            label={t('amcs.stats.renewals')}
                            value={formatNumber(summary.renewalsDue)}
                            detail={
                                summary.nextRenewal
                                    ? t('amcs.stats.renewalsDetail', { property: summary.nextRenewal.property, date: formatDate(summary.nextRenewal.date) })
                                    : t('amcs.stats.noRenewals')
                            }
                            href={summary.renewalsDue > 0 ? route(amcRoute(service), { state: ['expiring'] }) : undefined}
                        />
                        <StatCard
                            icon={CalendarCheckIcon}
                            tone={summary.visitsOverdue > 0 ? 'warning' : 'gold'}
                            label={t('amcs.stats.visits')}
                            value={formatNumber(summary.visitsDue)}
                            detail={
                                summary.visitsOverdue > 0
                                    ? t('amcs.stats.visitsOverdue', { count: summary.visitsOverdue })
                                    : summary.nextVisit
                                      ? t('amcs.stats.visitsDetail', { date: formatDate(summary.nextVisit.date), property: summary.nextVisit.property })
                                      : t('amcs.stats.noVisits')
                            }
                        />
                    </section>

                    {summary.uncovered.length > 0 && <UncoveredProperties service={service} properties={summary.uncovered} />}

                    <RecordList
                        routeName={amcRoute(service)}
                        filters={filters}
                        facets={{
                            state: facets.state.map((option) => ({ ...option, label: t(`amcs.states.${option.value}`), icon: STATE_ICONS[option.value] })),
                            properties: facets.properties.map((option) => ({ ...option, icon: Building2Icon })),
                        }}
                        labels={{ state: t('amcs.filters.state'), properties: t('amcs.filters.properties') }}
                        only={['contracts', 'facets']}
                        paginator={contracts}
                        searchLabel={t('amcs.searchLabel')}
                        searchPlaceholder={t('amcs.searchPlaceholder')}
                        empty={
                            <ListEmpty
                                icon={FileSignatureIcon}
                                title={t('amcs.empty.title')}
                                description={t(`amcs.services.${service}.empty`)}
                                action={addButton}
                            />
                        }
                    >
                        <DataTable
                            columns={columns}
                            rows={contracts.data}
                            actions={(contract) => (
                                <RowActions
                                    label={contract.number}
                                    items={[
                                        { label: t('amcs.actions.view'), href: route(amcRoute(service, 'show'), contract.id), icon: EyeIcon },
                                        { label: t('amcs.actions.edit'), href: route(amcRoute(service, 'edit'), contract.id), icon: PencilIcon },
                                        ...(contract.canRenew
                                            ? [{ label: t('amcs.actions.renew'), href: route(amcRoute(service, 'create'), { renew: contract.id }), icon: RefreshCwIcon }]
                                            : []),
                                    ]}
                                />
                            )}
                        />
                    </RecordList>
                </>
            )}
        </DashboardLayout>
    );
}
