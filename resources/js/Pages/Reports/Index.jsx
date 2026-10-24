import PageHeader from '@/Components/PageHeader';
import { NoCompany } from '@/Components/RecordList';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { useTranslation } from '@/hooks/use-translation';
import { useCanOpen } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowRightIcon,
    BedDoubleIcon,
    CalendarRangeIcon,
    ChartColumnBigIcon,
    CheckIcon,
    FileSpreadsheetIcon,
    HourglassIcon,
    PresentationIcon,
    PrinterIcon,
    ScaleIcon,
    UsersRoundIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * Every report, grouped by what it covers. `ability` follows the
 * navigation's (see canOpen); the company summary leads.
 */
const REPORT_GROUPS = [
    { key: 'company', reports: [{ key: 'summary', routeName: 'reports.summary', icon: PresentationIcon }] },
    {
        key: 'finance',
        reports: [
            { key: 'income', routeName: 'reports.income', icon: ScaleIcon },
            { key: 'receivables', routeName: 'reports.receivables', icon: HourglassIcon },
        ],
    },
    {
        key: 'operations',
        reports: [
            { key: 'occupancy', routeName: 'reports.occupancy', icon: BedDoubleIcon },
            { key: 'maintenance', routeName: 'reports.maintenance', icon: WrenchIcon },
        ],
    },
    { key: 'people', reports: [{ key: 'staff', routeName: 'reports.staff', icon: UsersRoundIcon, ability: 'viewStaff' }] },
];

/**
 * A report to open: what it is, what it holds and a link to it. The
 * featured one (the company summary) spans the row on the brand gradient.
 */
function ReportCard({ report, isFeatured = false }) {
    const { t, tOr } = useTranslation();
    const Icon = report.icon;
    const includes = tOr(`reports.${report.key}.includes`, []);

    return (
        <Link
            href={route(report.routeName)}
            className={cn(
                'group/report relative flex h-full flex-col gap-5 overflow-hidden rounded-xl p-5 ring-1 transition-[box-shadow,translate] duration-200 outline-none hover:-translate-y-0.5 hover:shadow-(--overlay-shadow) focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0 lg:p-6',
                isFeatured
                    ? 'bg-linear-to-br from-brand-navy to-[#0b4f8a] text-white shadow-lg shadow-brand-navy/20 ring-white/10 rtl:bg-linear-to-bl'
                    : 'bg-card text-card-foreground shadow-(--card-shadow) ring-foreground/[0.07]',
            )}
        >
            <div className="flex items-start gap-4">
                <span
                    className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-xl inset-ring',
                        isFeatured ? 'bg-white/12 text-brand-sun inset-ring-white/15' : 'bg-linear-to-br from-brand-cyan to-brand-navy text-white shadow-md inset-ring-white/25 rtl:bg-linear-to-bl',
                    )}
                >
                    <Icon className="size-5" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="font-heading text-lg font-bold tracking-tight">{t(`reports.${report.key}.title`)}</h3>
                    <p className={cn('text-[0.875rem] text-pretty', isFeatured ? 'text-white/75' : 'text-muted-foreground')}>{t(`reports.${report.key}.description`)}</p>
                </div>
            </div>
            <ul className={cn('grid gap-x-6 gap-y-2 text-[0.8125rem]', isFeatured && 'sm:grid-cols-2 xl:grid-cols-3')}>
                {includes.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                        <CheckIcon className={cn('mt-0.5 size-3.5 shrink-0', isFeatured ? 'text-brand-sun' : 'text-brand-ink')} />
                        <span className={isFeatured ? 'text-white/90' : undefined}>{line}</span>
                    </li>
                ))}
            </ul>
            <span className={cn('mt-auto inline-flex items-center gap-1.5 text-sm font-semibold', isFeatured ? 'text-brand-sun' : 'text-brand-ink')}>
                {t('reports.index.open')}
                <ArrowRightIcon className="size-4 transition-transform group-hover/report:translate-x-0.5 rtl:rotate-180 rtl:group-hover/report:-translate-x-0.5" />
            </span>
        </Link>
    );
}

/**
 * The reports home: every report the user can open, grouped by what it
 * covers, and what every report can do.
 */
export default function Index({ company }) {
    const { t } = useTranslation();
    const canOpen = useCanOpen();
    const title = t('reports.index.title');

    if (company === null) {
        return (
            <DashboardLayout>
                <Head title={title} />
                <PageHeader breadcrumbs={[{ label: title }]} title={title} description={t('reports.index.description')} />
                <NoCompany icon={ChartColumnBigIcon} />
            </DashboardLayout>
        );
    }

    const groups = REPORT_GROUPS.map((group) => ({ ...group, reports: group.reports.filter((report) => canOpen(report)) })).filter((group) => group.reports.length > 0);
    const features = [
        { key: 'period', icon: CalendarRangeIcon },
        { key: 'print', icon: PrinterIcon },
        { key: 'export', icon: FileSpreadsheetIcon },
    ];

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: title }]} title={title} description={t('reports.index.description')} />

            <ul aria-label={t('reports.index.featuresLabel')} className="grid gap-3 sm:grid-cols-3">
                {features.map(({ key, icon: Icon }) => (
                    <li key={key} className="flex items-start gap-3 rounded-xl bg-brand-cyan/[0.06] p-4 ring-1 ring-brand-cyan/15">
                        <Icon className="mt-0.5 size-4 shrink-0 text-brand-ink" />
                        <span className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold">{t(`reports.index.features.${key}.title`)}</span>
                            <span className="text-[0.8125rem] text-pretty text-muted-foreground">{t(`reports.index.features.${key}.description`)}</span>
                        </span>
                    </li>
                ))}
            </ul>

            {groups.map((group) => (
                <section key={group.key} aria-labelledby={`reports-${group.key}`} className="flex flex-col gap-3">
                    <h2 id={`reports-${group.key}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {t(`reports.index.groups.${group.key}`)}
                    </h2>
                    <div className={cn('grid gap-4', group.key !== 'company' && 'lg:grid-cols-2')}>
                        {group.reports.map((report) => (
                            <ReportCard key={report.key} report={report} isFeatured={group.key === 'company'} />
                        ))}
                    </div>
                </section>
            ))}
        </DashboardLayout>
    );
}
