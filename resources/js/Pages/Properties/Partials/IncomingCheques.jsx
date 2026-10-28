import ChequeSchedule from '@/Components/ChequeSchedule';
import { ListSearch } from '@/Components/ListToolbar';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { CircleAlertIcon, CircleCheckIcon, ClockIcon, HandCoinsIcon, ScrollTextIcon, Undo2Icon } from 'lucide-react';
import { useState } from 'react';

/**
 * The cheques by where they stand: expected and not handed over yet, in
 * the company's hands or at the bank, cleared (paid), and bounced or
 * handed back. A cancelled cheque shows under all only.
 */
const GROUPS = {
    to_collect: { stages: ['pending'], icon: ClockIcon, tone: 'text-muted-foreground' },
    in_hand: { stages: ['received', 'deposited'], icon: HandCoinsIcon, tone: 'text-brand-ink' },
    cleared: { stages: ['cleared'], icon: CircleCheckIcon, tone: 'text-success' },
    bounced: { stages: ['bounced', 'returned'], icon: Undo2Icon, tone: 'text-destructive' },
};

const inGroup = (cheque, group) => GROUPS[group].stages.includes(cheque.status);

const matchesFilter = (cheque, filter) => filter === 'all' || (filter === 'overdue' ? cheque.isOverdue : inGroup(cheque, filter));

const matchesSearch = (cheque, needle) =>
    [cheque.party?.name, cheque.agreement?.number, cheque.chequeNumber, cheque.bankName].some((value) => value?.toLowerCase().includes(needle));

/**
 * How many cheques are in each group and what they come to, side by side
 * and ruled apart; on a phone, two to a line.
 */
function ChequeFigures({ cheques, currency }) {
    const { t, formatCurrency, formatNumber } = useTranslation();

    return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-foreground/[0.08]">
            {Object.entries(GROUPS).map(([group, { icon: Icon, tone }]) => {
                const listed = cheques.filter((cheque) => inGroup(cheque, group));
                const amount = formatCurrency(listed.reduce((sum, cheque) => sum + cheque.amount, 0), currency);

                return (
                    <div key={group} className="flex min-w-0 flex-col gap-0.5 sm:px-4 sm:first:ps-0 sm:last:pe-0">
                        <dt className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            <Icon aria-hidden="true" className={cn('size-3.5 shrink-0', tone)} />
                            {t(`propertyPayments.cheques.groups.${group}`)}
                            <span className="tabular-nums">· {formatNumber(listed.length)}</span>
                        </dt>
                        <dd title={amount} className={cn('truncate font-heading text-[0.9375rem] font-semibold tabular-nums', listed.length > 0 ? tone : 'text-muted-foreground')}>
                            {amount}
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

/**
 * The cheques clients and short-term tenants give for renting here, dated
 * in the period or earlier and still to deal with. A cheque's status is
 * changed in place, one at a time or several ticked together; a cleared
 * cheque counts as paid on the client's bill.
 */
export default function IncomingCheques({ cheques, statuses, banks, currency, periodLabel }) {
    const { t, formatNumber } = useTranslation();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    if (cheques.length === 0) {
        return (
            <Card>
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <ScrollTextIcon />
                        </EmptyMedia>
                        <EmptyTitle>{t('propertyPayments.cheques.empty.title', { period: periodLabel })}</EmptyTitle>
                        <EmptyDescription>{t('propertyPayments.cheques.empty.description')}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </Card>
        );
    }

    const needle = search.trim().toLowerCase();
    const visible = cheques.filter((cheque) => matchesFilter(cheque, filter) && (needle === '' || matchesSearch(cheque, needle)));
    const overdue = cheques.filter((cheque) => cheque.isOverdue).length;
    const filters = [
        { key: 'all', count: cheques.length },
        ...(overdue > 0 ? [{ key: 'overdue', icon: CircleAlertIcon, count: overdue }] : []),
        ...Object.entries(GROUPS).map(([key, { icon }]) => ({ key, icon, count: cheques.filter((cheque) => inGroup(cheque, key)).length })),
    ];

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="gap-4 border-b pt-(--card-spacing)">
                <div className="flex flex-col gap-1">
                    <CardTitle>{t('propertyPayments.cheques.title', { period: periodLabel })}</CardTitle>
                    <CardDescription>{t('propertyPayments.cheques.description')}</CardDescription>
                </div>
                <ChequeFigures cheques={cheques} currency={currency} />
            </CardHeader>

            <div className="flex flex-col gap-3 border-b p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                <ToggleGroup
                    variant="outline"
                    spacing={0}
                    value={[filter]}
                    onValueChange={([value]) => value && setFilter(value)}
                    aria-label={t('propertyPayments.cheques.filter')}
                    className="max-w-full overflow-x-auto"
                >
                    {filters.map(({ key, icon: Icon, count }) => (
                        <ToggleGroupItem key={key} value={key} className="gap-2 px-3 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                            {Icon && <Icon data-icon="inline-start" />}
                            {key === 'all' ? t('propertyPayments.cheques.all') : t(`propertyPayments.cheques.groups.${key}`)}
                            <span className="text-xs opacity-70 tabular-nums">{formatNumber(count)}</span>
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <ListSearch
                    id="payment-cheques-search"
                    value={search}
                    onChange={setSearch}
                    placeholder={t('propertyPayments.cheques.search')}
                    label={t('propertyPayments.cheques.searchLabel')}
                />
            </div>

            {visible.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('propertyPayments.cheques.noMatches')}</p>
            ) : (
                <ChequeSchedule cheques={visible} currency={currency} statuses={statuses} banks={banks} showParty selectable quickSettle />
            )}
        </Card>
    );
}
