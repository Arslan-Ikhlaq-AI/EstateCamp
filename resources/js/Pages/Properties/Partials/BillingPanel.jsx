import { METHOD_ICONS, RentalStatusBadge } from '@/Components/FinanceBadges';
import { ContractStatusBadge, ToneBadge } from '@/Components/LeasingBadges';
import { ListSearch } from '@/Components/ListToolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link, useForm } from '@inertiajs/react';
import {
    Building2Icon,
    CheckIcon,
    ChevronDownIcon,
    ChevronsDownUpIcon,
    ChevronsUpDownIcon,
    CircleCheckIcon,
    FileTextIcon,
    HandCoinsIcon,
    InfoIcon,
    KeyRoundIcon,
    ReceiptTextIcon,
    ScrollTextIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { AllocationPill, KIND_ICONS, unitDetails } from './AllocationPanel';

/**
 * Each kind of account in the colours of the allocation tabs: green for a
 * contract, violet for a short-term rental.
 */
const ACCOUNT_STYLES = {
    contract: { allocation: 'contract', swatch: 'bg-success', tile: 'bg-success/12 text-success', icon: FileTextIcon },
    rental: { allocation: 'short_term', swatch: 'bg-violet-500', tile: 'bg-violet-500/12 text-violet-700 dark:text-violet-300', icon: KeyRoundIcon },
};

const OPEN_ROUTES = { contract: 'contracts.show', rental: 'rentals.show' };

const PAYMENT_ROUTES = { contract: 'payments.show', rental: 'rental-payments.show' };

const UNIT_KINDS = ['rooms', 'shops', 'apartments'];

/**
 * The figures of a bill, in the order a statement reads them.
 */
const FIGURES = ['broughtForward', 'charged', 'total', 'received', 'balance'];

const cents = (value) => Math.round(value * 100) / 100;

/**
 * A statement's figures: the balance brought forward, the new charges,
 * the two together as the total bill, what was paid, and the balance
 * carried into the next bill.
 */
function billFigures(statement) {
    return {
        broughtForward: statement.broughtForward,
        charged: statement.charged,
        total: cents(statement.broughtForward + statement.charged),
        received: statement.received,
        balance: statement.carriedForward,
    };
}

/**
 * Unpaid rent from before shows in gold, money paid and credit in green.
 */
function figureTone(name, value) {
    if (name === 'broughtForward') {
        return value > 0 ? 'text-gold-ink' : value < 0 ? 'text-success' : 'text-muted-foreground';
    }

    if (name === 'received') {
        return value > 0 ? 'text-success' : 'text-muted-foreground';
    }

    if (name === 'balance' && value <= 0) {
        return 'text-success';
    }

    return 'text-foreground';
}

/**
 * The five figures of a bill side by side, ruled apart; on a phone, two
 * to a line. A balance paid beyond the bill reads as credit.
 */
function BillFigures({ figures, currency, isLarge = false }) {
    const { t, formatCurrency } = useTranslation();

    return (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5 sm:gap-x-0 sm:divide-x sm:divide-foreground/[0.08]">
            {FIGURES.map((name) => {
                const isCredit = name === 'balance' && figures[name] < 0;
                const value = formatCurrency(isCredit ? -figures[name] : figures[name], currency);

                return (
                    <div key={name} className="flex min-w-0 flex-col gap-0.5 sm:px-4 sm:first:ps-0 sm:last:pe-0">
                        <dt className="truncate text-xs text-muted-foreground">{t(`propertyAllocation.billing.figures.${isCredit ? 'credit' : name}`)}</dt>
                        <dd
                            title={value}
                            className={cn(
                                'truncate font-heading tabular-nums',
                                isLarge ? 'text-lg' : 'text-[0.9375rem]',
                                name === 'total' || name === 'balance' ? 'font-bold' : 'font-semibold',
                                figureTone(name, figures[name]),
                            )}
                        >
                            {value}
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}

/**
 * What an account holds here, such as "2 rooms · 1 shop".
 */
function useUnitsSummary() {
    const { t } = useTranslation();

    return (units) =>
        UNIT_KINDS.map((kind) => [kind, units.filter((unit) => unit.kind === kind).length])
            .filter(([, count]) => count > 0)
            .map(([kind, count]) => t(`propertyAllocation.billing.units.${kind}`, { count }))
            .join(' · ');
}

/**
 * The line under the payment box: an error, or what the amount typed will
 * do (pay ahead, or more than the agreement can take), or where the bill
 * stands when it is paid up.
 */
function CollectHint({ error, toPay, carriedForward, amount, limit, currency }) {
    const { t, formatCurrency } = useTranslation();
    const money = (value) => formatCurrency(value, currency);

    if (error) {
        return <p className="text-xs text-destructive md:text-end">{error}</p>;
    }

    if (amount > 0 && limit !== null && amount > limit + 0.005) {
        return <p className="text-xs text-destructive md:text-end">{t('propertyAllocation.billing.collect.overLimit', { amount: money(limit) })}</p>;
    }

    if (amount > toPay + 0.005) {
        return (
            <p className="text-xs font-medium text-brand-ink md:text-end">{t('propertyAllocation.billing.collect.credit', { amount: money(cents(amount - toPay)) })}</p>
        );
    }

    if (toPay <= 0) {
        return (
            <p className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <CircleCheckIcon aria-hidden="true" className="size-3.5" />
                {carriedForward < 0 ? t('propertyAllocation.billing.collect.inCredit', { amount: money(-carriedForward) }) : t('propertyAllocation.billing.collect.paidUp')}
            </p>
        );
    }

    return null;
}

/**
 * The amount received, how it was paid and a tick to record it. Cheques
 * are left to the cheque register, where they wait to clear. More than is
 * due is paid ahead and comes off the next bill, up to the end of the
 * agreement; once nothing more can be taken, the bill says so instead.
 */
function CollectForm({ account, currency, propertyId, through, methods }) {
    const { t, formatCurrency } = useTranslation();
    const [isRecorded, setIsRecorded] = useState(false);
    const form = useForm({ amount: '', method: methods[0] });
    const { toPay, carriedForward } = account.statement;
    const limit = account.collectionLimit;
    const amount = Number(form.data.amount) || 0;
    const isOverLimit = limit !== null && amount > limit + 0.005;
    const methodItems = methods.map((method) => ({ value: method, label: t(`leasing.methods.${method}`), icon: METHOD_ICONS[method] }));
    const error = Object.values(form.errors)[0];

    useEffect(() => {
        if (!isRecorded) {
            return undefined;
        }

        const timer = setTimeout(() => setIsRecorded(false), 4000);

        return () => clearTimeout(timer);
    }, [isRecorded]);

    const submit = (event) => {
        event.preventDefault();
        form.transform((data) => ({ ...data, account: account.kind, account_id: account.id, through }));
        form.post(route('properties.billing.store', propertyId), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                form.reset('amount');
                setIsRecorded(true);
            },
        });
    };

    const recorded = isRecorded && (
        <p role="status" className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CircleCheckIcon aria-hidden="true" className="size-3.5" />
            {t('propertyAllocation.billing.collect.recorded')}
        </p>
    );

    if (!account.isBilled) {
        return <p className="max-w-60 text-xs text-pretty text-muted-foreground md:text-end">{t('propertyAllocation.billing.collect.notBilled')}</p>;
    }

    if (limit !== null && limit <= 0) {
        return (
            <div className="flex flex-col items-start gap-1.5 md:items-end">
                <ToneBadge tone="success" icon={CircleCheckIcon}>
                    {carriedForward < 0
                        ? t('propertyAllocation.billing.collect.inCredit', { amount: formatCurrency(-carriedForward, currency) })
                        : t(`propertyAllocation.billing.collect.${carriedForward > 0 ? 'paidSince' : 'paidUp'}`)}
                </ToneBadge>
                {recorded}
            </div>
        );
    }

    return (
        <form onSubmit={submit} aria-label={t('propertyAllocation.billing.collect.label', { name: account.client.name })} className="flex flex-col gap-1.5 md:items-end">
            <div className="flex w-full items-center gap-2">
                <InputGroup className="min-w-0 flex-1 md:w-48 md:flex-none">
                    <InputGroupAddon>
                        <InputGroupText>{currency}</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={form.data.amount}
                        onChange={(event) => form.setData('amount', event.target.value)}
                        placeholder={t('propertyAllocation.billing.collect.placeholder')}
                        aria-label={t('propertyAllocation.billing.collect.amount')}
                        aria-invalid={Boolean(error)}
                        className="tabular-nums"
                    />
                    {toPay > 0 && (
                        <InputGroupAddon align="inline-end">
                            <Tooltip>
                                <TooltipTrigger render={<InputGroupButton onClick={() => form.setData('amount', String(toPay))} />}>
                                    {t('propertyAllocation.billing.collect.full')}
                                </TooltipTrigger>
                                <TooltipContent>{t('propertyAllocation.billing.collect.fill', { amount: formatCurrency(toPay, currency) })}</TooltipContent>
                            </Tooltip>
                        </InputGroupAddon>
                    )}
                </InputGroup>
                <Select items={methodItems} value={form.data.method} onValueChange={(value) => form.setData('method', value)}>
                    <SelectTrigger aria-label={t('propertyAllocation.billing.collect.method')} className="w-30 shrink-0 md:w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {methodItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    <item.icon />
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Tooltip>
                    <TooltipTrigger
                        render={
                            <Button
                                type="submit"
                                variant="brand"
                                size="icon"
                                className="shrink-0"
                                disabled={form.processing || amount <= 0 || isOverLimit}
                                aria-label={t('propertyAllocation.billing.collect.record')}
                            />
                        }
                    >
                        {form.processing ? <Spinner /> : <CheckIcon />}
                    </TooltipTrigger>
                    <TooltipContent>{t('propertyAllocation.billing.collect.record')}</TooltipContent>
                </Tooltip>
            </div>
            <CollectHint error={error} toPay={toPay} carriedForward={carriedForward} amount={amount} limit={limit} currency={currency} />
            {recorded}
        </form>
    );
}

/**
 * A titled part of an open account.
 */
function PanelSection({ title, children }) {
    return (
        <section className="flex min-w-0 flex-col gap-3">
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
            {children}
        </section>
    );
}

/**
 * The rooms, shops and apartments the account holds here in the period,
 * each with its share of the rent, then the rent a month for them all. A
 * holding replaced during the period is muted.
 */
function UnitsHeld({ account, currency, periodLabel }) {
    const { t, tOr, formatCurrency, formatDate } = useTranslation();
    const OpenIcon = ACCOUNT_STYLES[account.kind].icon;
    const notes = [
        account.kind === 'rental' && account.units.length > 1 && { key: 'whole', text: t('propertyAllocation.billing.wholeRental') },
        account.otherProperties > 0 && { key: 'other', text: t('propertyAllocation.billing.otherProperties', { count: account.otherProperties }) },
        account.chequesInHand.count > 0 && {
            key: 'cheques',
            icon: ScrollTextIcon,
            text: t('propertyAllocation.billing.chequesInHand', { count: account.chequesInHand.count, amount: formatCurrency(account.chequesInHand.amount, currency) }),
        },
    ].filter(Boolean);

    return (
        <div className="flex flex-col gap-3">
            {account.units.length === 0 ? (
                <p className="rounded-xl bg-card px-3.5 py-3 text-sm text-muted-foreground ring-1 ring-foreground/[0.08]">
                    {t('propertyAllocation.billing.noUnits', { period: periodLabel })}
                    {account.endsOn && ` ${t('propertyAllocation.billing.endedOn', { date: formatDate(account.endsOn) })}`}
                </p>
            ) : (
                <ul className="flex flex-col divide-y rounded-xl bg-card ring-1 ring-foreground/[0.08]">
                    {account.units.map((unit) => {
                        const Icon = KIND_ICONS[unit.kind];
                        const ownDates = unit.startsOn !== account.startsOn || unit.endsOn !== account.endsOn;
                        const detail = [
                            ...unitDetails(unit.kind, unit, t, tOr),
                            ownDates && `${formatDate(unit.startsOn)} – ${unit.endsOn ? formatDate(unit.endsOn) : t('propertyAllocation.openEnded')}`,
                        ]
                            .filter(Boolean)
                            .join(' · ');

                        return (
                            <li key={`${unit.kind}-${unit.id}`} className={cn('flex items-center gap-3 px-3.5 py-2.5', !unit.isLatest && 'opacity-60')}>
                                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                    <span dir="auto" className="truncate text-[0.8125rem] font-medium">
                                        {unit.number}
                                    </span>
                                    {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
                                </div>
                                <span className="text-[0.8125rem] whitespace-nowrap tabular-nums">{formatCurrency(unit.monthly, currency)}</span>
                            </li>
                        );
                    })}
                    <li className="flex items-center justify-between gap-3 bg-muted/40 px-3.5 py-2.5 text-[0.8125rem] font-semibold">
                        {t('propertyAllocation.billing.rentMonthly')}
                        <span className="whitespace-nowrap tabular-nums">{formatCurrency(account.monthly, currency)}</span>
                    </li>
                </ul>
            )}
            {notes.map(({ key, icon: Icon = InfoIcon, text }) => (
                <p key={key} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                    {text}
                </p>
            ))}
            <Button variant="outline" size="sm" className="self-start" nativeButton={false} render={<Link href={route(OPEN_ROUTES[account.kind], account.id)} />}>
                <OpenIcon data-icon="inline-start" />
                {t(`propertyAllocation.billing.open.${account.kind}`, { number: account.number })}
            </Button>
        </div>
    );
}

/**
 * One line of a statement: what it is, an optional detail under it, and
 * its amount. A total is set in bold over a rule.
 */
function StatementLine({ label, detail, value, isTotal = false, className }) {
    return (
        <div
            className={cn(
                'flex items-start justify-between gap-4 border-b border-foreground/[0.07] py-2.5 last:border-b-0',
                isTotal && 'border-t-2 border-t-foreground/15 first:border-t-0',
            )}
        >
            <dt className={cn('flex min-w-0 flex-col gap-0.5 text-[0.875rem]', isTotal && 'font-bold')}>
                <span>{label}</span>
                {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
            </dt>
            <dd className={cn('shrink-0 text-[0.9375rem] whitespace-nowrap tabular-nums', isTotal ? 'font-bold' : 'font-semibold', className)}>{value}</dd>
        </div>
    );
}

/**
 * A document number that opens it.
 */
function NumberLink({ href, children }) {
    return (
        <Link href={href} className="font-mono font-semibold text-brand-ink underline-offset-4 hover:underline">
            {children}
        </Link>
    );
}

/**
 * The account's statement for the period: the balance brought forward,
 * each charge that fell due, the total bill, each payment, and the
 * balance carried into the next bill, with what that balance means.
 */
function Statement({ account, currency }) {
    const { t, formatCurrency, formatDate } = useTranslation();
    const { statement } = account;
    const figures = billFigures(statement);
    const money = (value) => formatCurrency(value, currency);
    const range = (charge) => `${formatDate(charge.start)} – ${formatDate(charge.end)}`;

    const chargeDetail = (charge) => {
        if (charge.number) {
            return <NumberLink href={route('invoices.show', charge.id)}>{charge.number}</NumberLink>;
        }

        return charge.isPlanned ? t('propertyAllocation.billing.planned') : t('propertyAllocation.billing.dueOn', { date: formatDate(charge.chargedOn) });
    };

    let note = null;

    if (statement.carriedForward < 0) {
        note = t('propertyAllocation.billing.notes.credit');
    } else if (statement.carriedForward > 0) {
        if (statement.toPay === 0) {
            note = t('propertyAllocation.billing.notes.paidSince');
        } else if (statement.toPay < statement.carriedForward) {
            note = t('propertyAllocation.billing.notes.leftToPay', { amount: money(statement.toPay) });
        } else {
            note = t('propertyAllocation.billing.notes.carried');
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <dl className="flex flex-col rounded-xl bg-card px-3.5 ring-1 ring-foreground/[0.08]">
                <StatementLine
                    label={t('propertyAllocation.billing.figures.broughtForward')}
                    value={money(statement.broughtForward)}
                    className={figureTone('broughtForward', statement.broughtForward)}
                />
                {statement.charges.map((charge) => (
                    <StatementLine
                        key={charge.key}
                        label={t(`propertyAllocation.billing.charge.${charge.type}`, { period: range(charge) })}
                        detail={chargeDetail(charge)}
                        value={money(charge.amount)}
                    />
                ))}
                <StatementLine label={t('propertyAllocation.billing.figures.total')} value={money(figures.total)} isTotal />
                {statement.payments.map((payment) => (
                    <StatementLine
                        key={payment.key}
                        label={t('propertyAllocation.billing.paidOn', { date: formatDate(payment.paidOn) })}
                        detail={
                            <>
                                {t(`leasing.methods.${payment.method}`)} · <NumberLink href={route(PAYMENT_ROUTES[account.kind], payment.id)}>{payment.number}</NumberLink>
                            </>
                        }
                        value={money(-payment.amount)}
                        className="text-success"
                    />
                ))}
                <StatementLine
                    label={t('propertyAllocation.billing.figures.balance')}
                    value={money(statement.carriedForward)}
                    isTotal
                    className={figureTone('balance', statement.carriedForward)}
                />
            </dl>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
    );
}

/**
 * One company's bill as a row that opens. Its header names the company
 * and the contract or rental it is billed under, what it holds here and
 * for how long, the figures of its bill and the box to collect a payment.
 * Open, it lists the units it holds and its statement for the period.
 */
function AccountRow({ account, currency, propertyId, through, periodLabel, methods, isOpen, onOpenChange }) {
    const { t, formatDate } = useTranslation();
    const unitsSummary = useUnitsSummary();
    const style = ACCOUNT_STYLES[account.kind];
    const summary = [
        unitsSummary(account.units) || t('propertyAllocation.billing.nothingHere'),
        `${formatDate(account.startsOn)} – ${account.endsOn ? formatDate(account.endsOn) : t('propertyAllocation.openEnded')}`,
        t(`leasing.billingCycles.${account.billingCycle}`),
    ].join(' · ');

    return (
        <Collapsible open={isOpen} onOpenChange={onOpenChange}>
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:px-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
                    <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
                        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', style.tile)}>
                            <Building2Icon aria-hidden="true" className="size-5" />
                        </span>
                        <span className="flex min-w-0 flex-col gap-1">
                            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <span dir="auto" className="min-w-0 truncate font-heading text-base font-bold">
                                    {account.client.name}
                                </span>
                                <AllocationPill allocation={style.allocation} />
                                <span className="rounded-md bg-brand-cyan/10 px-1.5 py-px font-mono text-[0.6875rem] font-semibold whitespace-nowrap text-brand-ink">
                                    {account.number}
                                </span>
                                {account.status !== 'active' &&
                                    (account.kind === 'contract' ? <ContractStatusBadge status={account.status} /> : <RentalStatusBadge status={account.status} />)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{summary}</span>
                        </span>
                    </CollapsibleTrigger>
                    <div className="md:shrink-0">
                        <CollectForm account={account} currency={currency} propertyId={propertyId} through={through} methods={methods} />
                    </div>
                </div>
                <div className="md:ps-20">
                    <BillFigures figures={billFigures(account.statement)} currency={currency} />
                </div>
            </div>

            <CollapsibleContent>
                <div className="grid gap-6 border-t bg-muted/25 px-4 py-5 sm:px-5 lg:grid-cols-2 lg:gap-8 lg:px-6">
                    <PanelSection title={t('propertyAllocation.billing.unitsHeld')}>
                        <UnitsHeld account={account} currency={currency} periodLabel={periodLabel} />
                    </PanelSection>
                    <PanelSection title={t('propertyAllocation.billing.statement', { period: periodLabel })}>
                        <Statement account={account} currency={currency} />
                    </PanelSection>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

/**
 * The period's bills added up across every company, as one ruled line of
 * figures.
 */
function BillingTotals({ accounts, currency, periodLabel }) {
    const { t } = useTranslation();
    const totals = Object.fromEntries(FIGURES.map((name) => [name, cents(accounts.reduce((sum, account) => sum + billFigures(account.statement)[name], 0))]));
    const owing = accounts.filter((account) => account.statement.toPay > 0).length;
    const sharesContracts = accounts.some((account) => account.otherProperties > 0);

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t('propertyAllocation.billing.title', { period: periodLabel })}</CardTitle>
                <CardDescription>{t('propertyAllocation.billing.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <BillFigures figures={totals} currency={currency} isLarge />
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <span>{t('propertyAllocation.billing.accountCount', { count: accounts.length })}</span>
                    <span aria-hidden="true">·</span>
                    <span className={cn(owing > 0 && 'font-medium text-gold-ink')}>{t('propertyAllocation.billing.owingCount', { count: owing })}</span>
                    {sharesContracts && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span>{t('propertyAllocation.billing.sharedNote')}</span>
                        </>
                    )}
                </p>
            </CardContent>
        </Card>
    );
}

function NoBills({ periodLabel }) {
    const { t } = useTranslation();

    return (
        <Card>
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <ReceiptTextIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('propertyAllocation.billing.empty.title', { period: periodLabel })}</EmptyTitle>
                    <EmptyDescription>{t('propertyAllocation.billing.empty.description')}</EmptyDescription>
                </EmptyHeader>
            </Empty>
        </Card>
    );
}

const matchesFilter = (account, filter) =>
    filter === 'all' ||
    (filter === 'outstanding' && account.statement.toPay > 0) ||
    (filter === 'settled' && account.statement.toPay <= 0) ||
    account.kind === filter;

const matchesSearch = (account, needle) =>
    [account.client.name, account.number, ...account.units.map((unit) => unit.number)].some((value) => value?.toLowerCase().includes(needle));

/**
 * The billing tab: each company that rents here billed as a whole for the
 * period, a contract or a short-term rental, never room by room. Rows open
 * to show the units and the statement; a payment typed into a row and
 * ticked is recorded today, and whatever stays unpaid is brought into the
 * next period's bill.
 */
export default function BillingPanel({ accounts, currency, propertyId, period, periodLabel, methods }) {
    const { t, formatNumber } = useTranslation();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [openKeys, setOpenKeys] = useState([]);

    if (accounts.length === 0) {
        return <NoBills periodLabel={periodLabel} />;
    }

    const needle = search.trim().toLowerCase();
    const visibleAccounts = accounts.filter((account) => matchesFilter(account, filter) && (needle === '' || matchesSearch(account, needle)));
    const allOpen = visibleAccounts.length > 0 && visibleAccounts.every((account) => openKeys.includes(account.key));
    const filters = [
        { key: 'all', count: accounts.length },
        ...Object.entries(ACCOUNT_STYLES).map(([key, { swatch }]) => ({ key, swatch, count: accounts.filter((account) => account.kind === key).length })),
        { key: 'outstanding', icon: HandCoinsIcon, count: accounts.filter((account) => account.statement.toPay > 0).length },
        { key: 'settled', icon: CircleCheckIcon, count: accounts.filter((account) => account.statement.toPay <= 0).length },
    ];
    const setOpen = (key, isOpen) => setOpenKeys((keys) => (isOpen ? [...keys, key] : keys.filter((openKey) => openKey !== key)));

    return (
        <div className="flex flex-col gap-6">
            <BillingTotals accounts={accounts} currency={currency} periodLabel={periodLabel} />

            <Card className="gap-0 overflow-hidden py-0">
                <div className="flex flex-col gap-3 border-b p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
                    <ToggleGroup
                        variant="outline"
                        spacing={0}
                        value={[filter]}
                        onValueChange={([value]) => value && setFilter(value)}
                        aria-label={t('propertyAllocation.billing.filter')}
                        className="max-w-full overflow-x-auto"
                    >
                        {filters.map(({ key, swatch, icon: Icon, count }) => (
                            <ToggleGroupItem key={key} value={key} className="gap-2 px-3 aria-pressed:bg-primary aria-pressed:text-primary-foreground">
                                {swatch && <span aria-hidden="true" className={cn('size-2 rounded-full', swatch)} />}
                                {Icon && <Icon data-icon="inline-start" />}
                                {t(`propertyAllocation.billing.filters.${key}`)}
                                <span className="text-xs opacity-70 tabular-nums">{formatNumber(count)}</span>
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <div className="flex items-center gap-2">
                        <ListSearch
                            id="billing-search"
                            value={search}
                            onChange={setSearch}
                            placeholder={t('propertyAllocation.billing.search')}
                            label={t('propertyAllocation.billing.searchLabel')}
                        />
                        <Button
                            variant="outline"
                            className="shrink-0"
                            disabled={visibleAccounts.length === 0}
                            onClick={() => setOpenKeys(allOpen ? [] : visibleAccounts.map((account) => account.key))}
                        >
                            {allOpen ? <ChevronsDownUpIcon data-icon="inline-start" /> : <ChevronsUpDownIcon data-icon="inline-start" />}
                            {t(`propertyAllocation.billing.${allOpen ? 'collapseAll' : 'expandAll'}`)}
                        </Button>
                    </div>
                </div>

                {visibleAccounts.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t('propertyAllocation.billing.noMatches')}</p>
                ) : (
                    <div className="flex flex-col divide-y">
                        {visibleAccounts.map((account) => (
                            <AccountRow
                                key={account.key}
                                account={account}
                                currency={currency}
                                propertyId={propertyId}
                                through={period.to}
                                periodLabel={periodLabel}
                                methods={methods}
                                isOpen={openKeys.includes(account.key)}
                                onOpenChange={(isOpen) => setOpen(account.key, isOpen)}
                            />
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
