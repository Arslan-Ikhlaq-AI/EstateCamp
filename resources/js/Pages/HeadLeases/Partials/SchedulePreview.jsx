import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { addMonths } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { useMemo } from 'react';

const MAX_PREVIEW_ROWS = 12;

/**
 * The cheques the terms would produce, worked out the same way as
 * HeadLease::plannedInstallments() on the server.
 */
export function useSchedule({ start_date, end_date, annual_rent, payments_per_year }) {
    return useMemo(() => {
        const perYear = Number(payments_per_year);
        const rent = Number(annual_rent);

        if (!start_date || !end_date || end_date <= start_date || !perYear || !rent) {
            return [];
        }

        const amount = Math.round((rent / perYear) * 100) / 100;
        const rows = [];

        for (let number = 1; number <= 240; number++) {
            const due = addMonths(start_date, (12 / perYear) * (number - 1));

            if (due > end_date) {
                break;
            }

            rows.push({ number, due, amount });
        }

        return rows;
    }, [start_date, end_date, annual_rent, payments_per_year]);
}

export default function SchedulePreview({ schedule, currency }) {
    const { t, formatDate, formatMoney } = useTranslation();
    const total = schedule.reduce((sum, row) => sum + row.amount, 0);

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('leasing.headLeases.form.preview.title')}</CardTitle>
                <CardDescription>{t('leasing.headLeases.form.preview.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                {schedule.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('leasing.headLeases.form.preview.empty')}</p>
                ) : (
                    <div className="flex flex-col gap-3">
                        <ol className="flex flex-col divide-y text-sm">
                            {schedule.slice(0, MAX_PREVIEW_ROWS).map((row) => (
                                <li key={row.number} className="flex items-center justify-between gap-3 py-1.5">
                                    <span className="text-muted-foreground tabular-nums">
                                        {row.number}. {formatDate(row.due)}
                                    </span>
                                    <span className="font-medium tabular-nums">{formatMoney(row.amount, currency)}</span>
                                </li>
                            ))}
                        </ol>
                        {schedule.length > MAX_PREVIEW_ROWS && (
                            <p className="text-xs text-muted-foreground">{t('leasing.headLeases.form.preview.more', { count: schedule.length - MAX_PREVIEW_ROWS })}</p>
                        )}
                        <div className="flex items-center justify-between border-t pt-3 text-sm">
                            <span className="text-muted-foreground">{t('leasing.headLeases.form.preview.total', { count: schedule.length })}</span>
                            <span className="font-semibold tabular-nums">{formatMoney(total, currency)}</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
