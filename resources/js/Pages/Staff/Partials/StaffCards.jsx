import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import { DocumentStatusBadge, SalaryStatusBadge, useAbsences, useCalendarFormat } from '@/Components/StaffBadges';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { BanknoteIcon, IdCardIcon } from 'lucide-react';

/**
 * The monthly salary, its parts and how it is paid.
 */
export function SalaryCard({ salary, currency }) {
    const { t, formatMoney } = useTranslation();

    return (
        <SectionCard title={t('staff.show.salary')} action={<BanknoteIcon className="size-4 text-muted-foreground" />}>
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">{t('staff.show.total')}</span>
                    <span className="font-heading text-2xl font-bold tracking-tight tabular-nums">{formatMoney(salary.gross, currency)}</span>
                </div>
                <dl className="flex flex-col divide-y text-sm">
                    {[
                        ['basic', salary.basic],
                        ['housing', salary.housing],
                        ['transport', salary.transport],
                        ['other', salary.other],
                    ].map(([part, amount]) => (
                        <div key={part} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                            <dt className="text-muted-foreground">{t(`staff.show.${part}`)}</dt>
                            <dd className="font-medium tabular-nums">{formatMoney(amount, currency)}</dd>
                        </div>
                    ))}
                </dl>
                <DetailList
                    columns={1}
                    rows={[
                        { label: t('staff.show.paidBy'), value: salary.method && t(`staff.paymentMethods.${salary.method}`) },
                        ...(salary.method === 'bank_transfer'
                            ? [
                                  { label: t('staff.show.bank'), value: salary.bankName },
                                  { label: t('staff.show.iban'), value: salary.iban && <span className="font-mono text-[0.8125rem]">{salary.iban}</span> },
                              ]
                            : []),
                    ]}
                />
            </div>
        </SectionCard>
    );
}

/**
 * The Emirates ID, passport and visa, with when each runs out.
 */
export function DocumentsCard({ documents }) {
    const { t, formatDate } = useTranslation();

    return (
        <SectionCard title={t('staff.show.documents')} description={t('staff.show.documentsDescription')} action={<IdCardIcon className="size-4 text-muted-foreground" />}>
            <ul className="flex flex-col divide-y">
                {documents.map((document) => (
                    <li key={document.type} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-sm font-medium">{t(`staff.documents.${document.type}`)}</span>
                            {document.number && <span className="truncate font-mono text-xs text-muted-foreground">{document.number}</span>}
                            {document.expiresOn && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {t('staff.show.expiresOn', { date: formatDate(document.expiresOn) })} ·{' '}
                                    {document.days === 0
                                        ? t('alerts.expiresToday')
                                        : document.days < 0
                                          ? t('alerts.expiredAgo', { count: Math.abs(document.days) })
                                          : t('alerts.expiresIn', { count: document.days })}
                                </span>
                            )}
                        </div>
                        <DocumentStatusBadge days={document.days} />
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
}

/**
 * A staff member's salaries, newest first: the days paid for, deductions,
 * net pay and whether it was paid. With `linkToPayroll` each month opens
 * that month's payroll.
 */
export function SalaryHistory({ salaries, currency, linkToPayroll = false, empty }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const { formatMonth } = useCalendarFormat();
    const absences = useAbsences();

    if (salaries.length === 0) {
        return <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 lg:px-6">{empty}</p>;
    }

    return (
        <DataTable
            rows={salaries}
            columns={[
                {
                    id: 'month',
                    header: t('staff.payroll.month'),
                    cell: (salary) =>
                        linkToPayroll ? (
                            <Link href={route('payroll.index', { month: salary.period })} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                {formatMonth(salary.period)}
                            </Link>
                        ) : (
                            <span className="font-medium">{formatMonth(salary.period)}</span>
                        ),
                },
                {
                    id: 'days',
                    header: t('staff.payroll.columns.days'),
                    cell: (salary) => (
                        <div className="flex flex-col text-sm tabular-nums">
                            <span>{t('staff.payroll.days', { payable: salary.payableDays, total: salary.daysInMonth })}</span>
                            <span className="text-xs text-muted-foreground">{absences(salary.attendance)}</span>
                        </div>
                    ),
                },
                {
                    id: 'deductions',
                    header: t('staff.payroll.columns.deductions'),
                    align: 'end',
                    cell: (salary) => <span className="tabular-nums">{formatMoney(salary.absenceDeduction + salary.deductions, currency)}</span>,
                },
                {
                    id: 'net',
                    header: t('staff.payroll.columns.net'),
                    align: 'end',
                    cell: (salary) => <span className="font-semibold tabular-nums">{formatMoney(salary.netPay, currency)}</span>,
                },
                {
                    id: 'status',
                    header: t('staff.payroll.columns.status'),
                    cell: (salary) => (
                        <div className="flex flex-col items-start gap-0.5">
                            <SalaryStatusBadge status={salary.status} />
                            {salary.paidOn && <span className="text-xs text-muted-foreground tabular-nums">{formatDate(salary.paidOn)}</span>}
                        </div>
                    ),
                },
            ]}
        />
    );
}
