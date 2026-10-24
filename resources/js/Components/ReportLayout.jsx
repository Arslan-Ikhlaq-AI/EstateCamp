import PageHeader from '@/Components/PageHeader';
import PeriodFilter, { usePeriodLabel } from '@/Components/PeriodFilter';
import { NoCompany } from '@/Components/RecordList';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { ChevronDownIcon, ClockIcon, DownloadIcon, FileSpreadsheetIcon, PrinterIcon } from 'lucide-react';
import { useMemo } from 'react';

/**
 * Downloads for the report's tables, each a CSV that opens in Excel.
 * `exports` are `{ key, label, name, header, rows: () => rows }`; the file
 * is named after the table and the days the report covers.
 */
function ExportMenu({ exports, suffix }) {
    const { t } = useTranslation();

    if (exports.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
                <DownloadIcon data-icon="inline-start" />
                {t('reports.common.export')}
                <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('reports.common.exportLabel')}</DropdownMenuLabel>
                    {exports.map((item) => (
                        <DropdownMenuItem key={item.key} onClick={() => downloadCsv(`${item.name}-${suffix}.csv`, item.header, item.rows())}>
                            <FileSpreadsheetIcon />
                            {item.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * The company's letterhead at the top of a printed report, with what the
 * report covers. It shows on paper only.
 */
function Letterhead({ company, title, covers, preparedLine }) {
    return (
        <div className="hidden flex-col gap-4 border-b-2 border-brand-navy/20 pb-4 print:flex">
            <div className="flex items-start justify-between gap-6">
                <div className="flex flex-col gap-0.5 text-xs">
                    {company.logoUrl && <img src={company.logoUrl} alt="" className="mb-1.5 h-10 w-auto self-start" />}
                    <span className="text-sm font-semibold">{company.legalName ?? company.name}</span>
                    {company.address.length > 0 && <span>{company.address.join(', ')}</span>}
                    {[company.phone, company.email].filter(Boolean).length > 0 && <span>{[company.phone, company.email].filter(Boolean).join(' · ')}</span>}
                </div>
                <div className="flex flex-col items-end gap-0.5 text-end">
                    <span className="font-heading text-lg font-black tracking-wide uppercase">{title}</span>
                    <span className="text-sm font-medium">{covers}</span>
                    <span className="text-xs">{preparedLine}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * A report page: its title with export and print buttons, the period it
 * covers (or the day it stands on), when it was prepared and by whom, then
 * the report. On paper the app around it is hidden and the company's
 * letterhead heads the page.
 */
export default function ReportLayout({ title, description, icon, routeName, company, prepared, period, asOf, comparedWith, exports = [], children }) {
    const { t, formatDate } = useTranslation();
    const { full } = usePeriodLabel();
    const breadcrumbs = [{ label: t('nav.reports'), href: route('reports.index') }, { label: title }];

    if (company === null) {
        return (
            <DashboardLayout>
                <Head title={title} />
                <PageHeader breadcrumbs={breadcrumbs} title={title} description={description} />
                <NoCompany icon={icon} />
            </DashboardLayout>
        );
    }

    const covers = period ? full(period) : t('reports.common.asOf', { date: formatDate(asOf) });
    const suffix = period ? (period.from ? `${period.from}_${period.to}` : 'all-time') : asOf;
    const preparedLine = t('reports.common.prepared', { date: formatDate(prepared.date), time: prepared.time, name: prepared.by });
    const changePeriod = (value) => router.get(route(routeName), { period: value || undefined }, { preserveScroll: true });

    return (
        <DashboardLayout>
            <Head title={`${title} · ${covers}`} />

            {/* Reports print on landscape pages (see app.css), so wide tables fit. */}
            <div data-slot="report" className="flex flex-col gap-6 lg:gap-8">
                <Letterhead company={company} title={title} covers={covers} preparedLine={preparedLine} />

                <PageHeader
                    breadcrumbs={breadcrumbs}
                    title={title}
                    description={description}
                    actionsClassName="print:hidden"
                    actions={
                        <>
                            <ExportMenu exports={exports} suffix={suffix} />
                            <Button variant="outline" onClick={() => window.print()}>
                                <PrinterIcon data-icon="inline-start" />
                                {t('reports.common.print')}
                            </Button>
                        </>
                    }
                />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 print:hidden">
                    {period ? (
                        <PeriodFilter period={period} onChange={changePeriod} />
                    ) : (
                        <span className="text-sm font-medium">{covers}</span>
                    )}
                    {comparedWith && <span className="text-sm text-muted-foreground">{t('reports.common.comparedWith', { period: comparedWith })}</span>}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:ms-auto">
                        <ClockIcon className="size-3.5" />
                        {preparedLine}
                    </span>
                </div>

                {children}
            </div>
        </DashboardLayout>
    );
}

// On paper a report's tables shrink to the page instead of scrolling, so no column is cut off.
const PRINT_TABLES =
    'print:[&_[data-slot=table-container]]:overflow-visible print:[&_table]:text-[0.6875rem] print:[&_td]:px-1.5 print:[&_th]:px-1.5 print:[&_th]:whitespace-normal';

/**
 * A titled part of a report. `flush` lets a table run edge to edge.
 */
export function ReportSection({ title, description, action, flush = false, className, contentClassName, children }) {
    return (
        <Card className={cn('break-inside-avoid print:shadow-none print:ring-foreground/20', PRINT_TABLES, className)}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
                {action && <CardAction className="print:hidden">{action}</CardAction>}
            </CardHeader>
            <CardContent className={cn(flush && 'px-0', contentClassName)}>{children}</CardContent>
        </Card>
    );
}

const FIGURE_COLUMNS = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
};

/**
 * Labelled figures in a grid, each with an optional badge (such as the
 * change on the period before) and a line of detail. A `tone` of
 * `negative` or `warning` colours the figure; the label always names it.
 */
export function Figures({ items, columns = 4 }) {
    return (
        <dl className={cn('grid gap-x-6 gap-y-5', FIGURE_COLUMNS[columns])}>
            {items.map((item) => (
                <div key={item.label} className="flex min-w-0 flex-col gap-1">
                    <dt className="text-[0.8125rem] text-muted-foreground">{item.label}</dt>
                    <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span
                            className={cn(
                                'font-heading text-xl font-bold tracking-tight tabular-nums',
                                item.tone === 'negative' && 'text-destructive',
                                item.tone === 'warning' && 'text-warning',
                            )}
                        >
                            {item.value}
                        </span>
                        {item.badge}
                    </dd>
                    {item.detail && <dd className="text-xs text-pretty text-muted-foreground">{item.detail}</dd>}
                </div>
            ))}
        </dl>
    );
}

/**
 * A thin bar showing `value` as a share of `max`, beside a figure that
 * names it.
 */
export function ShareBar({ value, max, color = 'var(--cash-in)', className }) {
    const share = max > 0 ? Math.min(100, (value / max) * 100) : 0;

    return (
        <div aria-hidden="true" className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted print:border print:border-foreground/20', className)}>
            <div className="h-full rounded-full print:[print-color-adjust:exact]" style={{ width: `${share}%`, backgroundColor: color }} />
        </div>
    );
}

/**
 * Formats amounts for a wide table: two decimals and no currency, which
 * the section names once instead.
 */
export function useAmountFormat() {
    const { locale } = useTranslation();

    return useMemo(() => {
        const format = new Intl.NumberFormat(LOCALES[locale].intl, { minimumFractionDigits: 2, maximumFractionDigits: 2, numberingSystem: 'latn' });

        return (value) => format.format(value);
    }, [locale]);
}

/**
 * An amount in a wide table, or a dash when there is none, so the figures
 * that matter stand out.
 */
export function Amount({ value, className }) {
    const format = useAmountFormat();

    return value === 0 ? <span className="text-muted-foreground">—</span> : <span className={cn('tabular-nums', className)}>{format(value)}</span>;
}

/**
 * A short line for a part of a report with nothing in it.
 */
export function ReportEmpty({ children }) {
    return <p className="flex min-h-24 items-center justify-center rounded-xl bg-muted/50 px-4 text-center text-sm text-muted-foreground">{children}</p>;
}
