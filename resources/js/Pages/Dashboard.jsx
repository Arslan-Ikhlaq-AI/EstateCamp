import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, usePage } from '@inertiajs/react';
import { BellRingIcon, Building2Icon, LogInIcon, PercentIcon, ReceiptIcon } from 'lucide-react';
import AttentionCard from './Dashboard/Partials/AttentionCard';
import BedCapacity from './Dashboard/Partials/BedCapacity';
import ChequesOverview from './Dashboard/Partials/ChequesOverview';
import CollectionsChart from './Dashboard/Partials/CollectionsChart';
import DocumentsCard from './Dashboard/Partials/DocumentsCard';
import InvoiceStatus from './Dashboard/Partials/InvoiceStatus';
import KpiCards from './Dashboard/Partials/KpiCards';
import OccupancyTrend from './Dashboard/Partials/OccupancyTrend';
import PaymentMethods from './Dashboard/Partials/PaymentMethods';
import PropertiesOverview from './Dashboard/Partials/PropertiesOverview';
import RecentActivity from './Dashboard/Partials/RecentActivity';
import RentCapture from './Dashboard/Partials/RentCapture';
import RoomTypeMix from './Dashboard/Partials/RoomTypeMix';
import TopDebtors from './Dashboard/Partials/TopDebtors';

function greetingKey(hour) {
    if (hour < 12) {
        return 'dashboard.greeting.morning';
    }

    return hour < 17 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening';
}

/**
 * The welcome banner on the brand navy: today's date, the greeting, the
 * portfolio's headline occupancy and the two most common next steps:
 * recording a payment and checking someone in.
 */
function Greeting({ company, summary }) {
    const { t, formatLongDate, formatPercent } = useTranslation();
    const { auth, notifications = [] } = usePage().props;
    const now = new Date();
    const firstName = auth.user.name.split(/\s+/)[0];
    const { beds } = summary;

    // The first name is set apart in gold; a placeholder marks where it goes in each language.
    const [before, after] = t(greetingKey(now.getHours()), { name: '\u0000' }).split('\u0000');

    return (
        <section className="relative isolate overflow-hidden rounded-2xl bg-brand-navy px-6 py-7 text-white shadow-(--card-shadow) ring-1 ring-white/10 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -end-24 -top-32 -z-10 size-96 rounded-full bg-brand-cyan/30 blur-3xl"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute start-1/3 -bottom-40 -z-10 size-80 rounded-full bg-brand-cyan/10 blur-3xl"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -start-20 -bottom-28 -z-10 size-72 rounded-full bg-gold/20 blur-3xl"
            />

            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-2">
                    <p className="text-[0.875rem] font-medium text-brand-cyan">{formatLongDate(now)}</p>
                    <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-[2.25rem] sm:leading-tight">
                        {before}
                        <span className="bg-linear-to-r from-brand-sun to-gold bg-clip-text text-transparent">{firstName}</span>
                        {after}
                    </h1>
                    <p className="text-base text-white/70">{t('dashboard.subtitle', { company: company.name })}</p>

                    <ul className="mt-3 flex flex-wrap gap-2">
                        <li className="flex h-8 items-center gap-2 rounded-full bg-white/10 px-3.5 text-[0.875rem] text-white/85 inset-ring inset-ring-white/10">
                            <Building2Icon className="size-4 text-brand-cyan" />
                            {t('dashboard.portfolio', {
                                properties: t('dashboard.properties', { count: summary.properties }),
                                rooms: t('common.rooms', { count: summary.rooms }),
                            })}
                        </li>
                        {beds.occupancyRate !== null && (
                            <li className="flex h-8 items-center gap-2 rounded-full bg-white/10 px-3.5 text-[0.875rem] text-white/85 inset-ring inset-ring-white/10">
                                <PercentIcon className="size-4 text-brand-cyan" />
                                {t('dashboard.kpi.occupancy')} {formatPercent(beds.occupancyRate)}
                            </li>
                        )}
                        {notifications.length > 0 && (
                            <li className="flex h-8 items-center gap-2 rounded-full bg-gold/15 px-3.5 text-[0.875rem] font-medium text-brand-sun inset-ring inset-ring-gold/30">
                                <BellRingIcon className="size-4 text-gold" />
                                {t('header.notificationsCount', { count: notifications.length })}
                            </li>
                        )}
                    </ul>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <Button variant="glass" size="lg" nativeButton={false} render={<Link href={route('payments.create')} />}>
                        <ReceiptIcon data-icon="inline-start" />
                        {t('leasing.payments.add')}
                    </Button>
                    <Button variant="inverse" size="lg" nativeButton={false} render={<Link href={route('occupancies.create')} />}>
                        <LogInIcon data-icon="inline-start" />
                        {t('leasing.checkIn.button')}
                    </Button>
                </div>
            </div>
        </section>
    );
}

function NoCompany() {
    const { t } = useTranslation();

    return (
        <Empty className="border bg-card py-16 shadow-(--card-shadow)">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Building2Icon />
                </EmptyMedia>
                <EmptyTitle>{t('dashboard.noCompany.title')}</EmptyTitle>
                <EmptyDescription>{t('dashboard.noCompany.description')}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}

export default function Dashboard({ company, summary, finance, cheques, occupancyTrend, activity, properties, roomTypes, documents }) {
    const { t } = useTranslation();

    return (
        <DashboardLayout>
            <Head title={t('dashboard.title')} />

            {company === null ? (
                <NoCompany />
            ) : (
                <>
                    <Greeting company={company} summary={summary} />

                    <KpiCards summary={summary} finance={finance} currency={company.currency} />

                    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
                        <div className="flex min-w-0 flex-col gap-6">
                            <AttentionCard />

                            <ChequesOverview cheques={cheques} currency={company.currency} />

                            <CollectionsChart trend={finance.trend} currency={company.currency} />

                            <div className="grid gap-6 lg:grid-cols-2">
                                <OccupancyTrend trend={occupancyTrend} />
                                <BedCapacity beds={summary.beds} />
                            </div>

                            <div className="grid gap-6 lg:grid-cols-2">
                                <InvoiceStatus status={finance.invoiceStatus} />
                                <PaymentMethods methods={finance.paymentMethods} currency={company.currency} />
                            </div>

                            <PropertiesOverview properties={properties} currency={company.currency} />

                            <div className="grid gap-6 lg:grid-cols-2">
                                <RentCapture summary={summary} currency={company.currency} />
                                <RoomTypeMix roomTypes={roomTypes} />
                            </div>

                            <DocumentsCard documents={documents} />
                        </div>

                        <aside aria-label={t('dashboard.activity.title')} className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
                            <RecentActivity activity={activity} currency={company.currency} />
                            <TopDebtors debtors={finance.topDebtors} currency={company.currency} />
                        </aside>
                    </div>
                </>
            )}
        </DashboardLayout>
    );
}
