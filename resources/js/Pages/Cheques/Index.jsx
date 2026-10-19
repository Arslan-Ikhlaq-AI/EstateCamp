import ChequeSchedule from '@/Components/ChequeSchedule';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import RecordList, { ListEmpty, NoCompany } from '@/Components/RecordList';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowDownLeftIcon,
    ArrowUpRightIcon,
    BanknoteIcon,
    CalendarClockIcon,
    CalendarRangeIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleSlashIcon,
    ClockIcon,
    HandCoinsIcon,
    LandmarkIcon,
    PenLineIcon,
    SendIcon,
    ShieldCheckIcon,
    Undo2Icon,
    UndoIcon,
    WalletCardsIcon,
} from 'lucide-react';

const STATUS_ICONS = {
    pending: ClockIcon,
    received: HandCoinsIcon,
    issued: SendIcon,
    deposited: LandmarkIcon,
    cleared: CircleCheckIcon,
    bounced: Undo2Icon,
    returned: UndoIcon,
    cancelled: CircleSlashIcon,
};
const DUE_ICONS = { overdue: CircleAlertIcon, this_week: CalendarClockIcon, next_30_days: CalendarRangeIcon, to_collect: PenLineIcon };
const PURPOSE_ICONS = { rent: BanknoteIcon, security_deposit: ShieldCheckIcon };

/**
 * All cheques, those from clients, or those to landlords.
 */
function DirectionTabs({ direction }) {
    const { t } = useTranslation();
    const tabs = [
        { value: null, label: t('leasing.cheques.tabs.all'), icon: WalletCardsIcon },
        { value: 'received', label: t('leasing.cheques.tabs.received'), icon: ArrowDownLeftIcon },
        { value: 'issued', label: t('leasing.cheques.tabs.issued'), icon: ArrowUpRightIcon },
    ];

    return (
        <nav aria-label={t('leasing.cheques.title')} className="flex w-fit flex-wrap gap-1 rounded-2xl bg-muted/70 p-1 ring-1 ring-foreground/[0.06]">
            {tabs.map((tab) => {
                const isActive = direction === tab.value;

                return (
                    <Link
                        key={tab.label}
                        href={route('cheques.index', tab.value ? { direction: [tab.value] } : {})}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                            'flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                            isActive && 'bg-card text-foreground shadow-(--card-shadow) ring-1 ring-foreground/[0.06]',
                        )}
                    >
                        <tab.icon className={cn('size-4', isActive && 'text-brand-cyan')} />
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}

export default function Index({ company, filters, facets, summary, cheques }) {
    const { t, formatCurrency } = useTranslation();
    const title = t('leasing.cheques.title');
    const direction = filters?.direction?.length === 1 ? filters.direction[0] : null;

    const statusLabel = (status) =>
        status !== 'pending'
            ? t(`leasing.cheques.status.${status}`)
            : direction
              ? t(`leasing.cheques.status.pending_${direction}`)
              : `${t('leasing.cheques.status.pending_received')} / ${t('leasing.cheques.status.pending_issued')}`;

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.payments') }, { label: title }]} title={title} count={cheques?.total} description={t('leasing.cheques.description')} />

            <FlashMessages errorKeys={['action', 'cheque_number', 'date']} />

            {company === null ? (
                <NoCompany icon={WalletCardsIcon} />
            ) : (
                <>
                    <DirectionTabs direction={direction} />

                    <section aria-label={t('leasing.cheques.stats.label')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={LandmarkIcon}
                            tone={summary.toDeposit.count > 0 ? 'warning' : 'success'}
                            label={t('leasing.cheques.stats.toDeposit')}
                            value={formatCurrency(summary.toDeposit.amount, company.currency)}
                            detail={t('leasing.cheques.stats.toDepositDetail', { count: summary.toDeposit.count })}
                            href={route('cheques.index', { direction: ['received'], status: ['received'], due: ['overdue'] })}
                        />
                        <StatCard
                            icon={HandCoinsIcon}
                            label={t('leasing.cheques.stats.inHand')}
                            value={formatCurrency(summary.inHand.amount, company.currency)}
                            detail={
                                summary.atBank.count > 0
                                    ? t('leasing.cheques.stats.atBankDetail', { count: summary.atBank.count })
                                    : t('leasing.cheques.stats.inHandDetail', { count: summary.inHand.count })
                            }
                            href={route('cheques.index', { direction: ['received'], status: ['received'] })}
                        />
                        <StatCard
                            icon={ArrowUpRightIcon}
                            tone="gold"
                            label={t('leasing.cheques.stats.dueToPay')}
                            value={formatCurrency(summary.dueToPay.amount, company.currency)}
                            detail={t('leasing.cheques.stats.dueToPayDetail', { count: summary.dueToPay.count, written: summary.dueToPay.count - summary.toWrite.count })}
                            href={route('cheques.index', { direction: ['issued'], due: ['next_30_days'] })}
                        />
                        <StatCard
                            icon={Undo2Icon}
                            tone={summary.bounced.count > 0 ? 'warning' : 'success'}
                            label={t('leasing.cheques.stats.bounced')}
                            value={formatCurrency(summary.bounced.amount, company.currency)}
                            detail={summary.bounced.count > 0 ? t('leasing.cheques.stats.bouncedDetail', { count: summary.bounced.count }) : t('leasing.cheques.stats.bouncedNone')}
                            href={route('cheques.index', { status: ['bounced'] })}
                        />
                    </section>

                    <RecordList
                        routeName="cheques.index"
                        filters={filters}
                        facets={{
                            status: facets.status.map((option) => ({ ...option, label: statusLabel(option.value), icon: STATUS_ICONS[option.value] })),
                            due: facets.due.map((option) => ({ ...option, label: t(`leasing.cheques.due.${option.value}`), icon: DUE_ICONS[option.value] })),
                            purpose: facets.purpose.map((option) => ({ ...option, label: t(`leasing.cheques.purposes.${option.value}`), icon: PURPOSE_ICONS[option.value] })),
                        }}
                        labels={{
                            status: t('leasing.cheques.filters.status'),
                            due: t('leasing.cheques.filters.due'),
                            purpose: t('leasing.cheques.filters.purpose'),
                        }}
                        only={['cheques', 'facets', 'summary']}
                        paginator={cheques}
                        searchLabel={t('leasing.cheques.searchLabel')}
                        searchPlaceholder={t('leasing.cheques.searchPlaceholder')}
                        empty={<ListEmpty icon={WalletCardsIcon} title={t('leasing.cheques.empty.title')} description={t('leasing.cheques.empty.description')} />}
                    >
                        <ChequeSchedule cheques={cheques.data} currency={company.currency} showParty />
                    </RecordList>
                </>
            )}
        </DashboardLayout>
    );
}
