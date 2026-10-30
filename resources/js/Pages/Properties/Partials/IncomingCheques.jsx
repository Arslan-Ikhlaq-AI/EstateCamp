import ChequeSchedule from '@/Components/ChequeSchedule';
import { ListSearch } from '@/Components/ListToolbar';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTranslation } from '@/hooks/use-translation';
import { CircleAlertIcon, CircleCheckIcon, ClockIcon, HandCoinsIcon, ScrollTextIcon, Undo2Icon } from 'lucide-react';
import { useState } from 'react';

/**
 * The cheques by where they stand: expected and not handed over yet, in
 * the company's hands or at the bank, cleared (paid), and bounced or
 * handed back. A cancelled cheque shows under all only.
 */
const GROUPS = {
    to_collect: { stages: ['pending'], icon: ClockIcon },
    in_hand: { stages: ['received', 'deposited'], icon: HandCoinsIcon },
    cleared: { stages: ['cleared'], icon: CircleCheckIcon },
    bounced: { stages: ['bounced', 'returned'], icon: Undo2Icon },
};

const inGroup = (cheque, group) => GROUPS[group].stages.includes(cheque.status);

const matchesFilter = (cheque, filter) => filter === 'all' || (filter === 'overdue' ? cheque.isOverdue : inGroup(cheque, filter));

const matchesSearch = (cheque, needle) =>
    [cheque.party?.name, cheque.agreement?.number, cheque.chequeNumber, cheque.bankName].some((value) => value?.toLowerCase().includes(needle));

/**
 * The cheques of one part of the payments in, dated in the period or
 * earlier and still to deal with, filtered by where they stand and
 * searched. A cheque's status is changed in place, one at a time or
 * several ticked together; a cleared cheque counts as paid on the bill.
 * `empty` is what to say when there are none; `groupNames` renames the
 * filters and `settleAs` words the one-step button, so short-term cheques
 * read as submitted or not.
 */
export default function IncomingCheques({ cheques, statuses, banks, currency, searchId, empty, groupNames = {}, settleAs = true }) {
    const { t, formatNumber } = useTranslation();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    if (cheques.length === 0) {
        return (
            <Empty className="py-8 md:py-10">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <ScrollTextIcon />
                    </EmptyMedia>
                    <EmptyTitle>{empty.title}</EmptyTitle>
                    <EmptyDescription>{empty.description}</EmptyDescription>
                </EmptyHeader>
            </Empty>
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
        <div className="flex flex-col">
            <div className="flex flex-col gap-3 px-4 pb-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
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
                            {key === 'all' ? t('propertyPayments.cheques.all') : (groupNames[key] ?? t(`propertyPayments.cheques.groups.${key}`))}
                            <span className="text-xs opacity-70 tabular-nums">{formatNumber(count)}</span>
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
                <ListSearch
                    id={searchId}
                    value={search}
                    onChange={setSearch}
                    placeholder={t('propertyPayments.cheques.search')}
                    label={t('propertyPayments.cheques.searchLabel')}
                />
            </div>

            <div className="border-t">
                {visible.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('propertyPayments.cheques.noMatches')}</p>
                ) : (
                    <ChequeSchedule cheques={visible} currency={currency} statuses={statuses} banks={banks} showParty selectable quickSettle={settleAs} />
                )}
            </div>
        </div>
    );
}
