import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import PeriodFilter, { usePeriodLabel } from '@/Components/PeriodFilter';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, router } from '@inertiajs/react';
import {
    BadgePercentIcon,
    BanknoteIcon,
    CalendarClockIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    ClockIcon,
    EyeIcon,
    FileSignatureIcon,
    FileStackIcon,
    HandCoinsIcon,
    LandmarkIcon,
    LayoutPanelLeftIcon,
    ReceiptIcon,
    ScrollTextIcon,
    Undo2Icon,
    WalletIcon,
    WrenchIcon,
} from 'lucide-react';
import { useState } from 'react';
import { CashHandoverButton } from './Partials/CashHandover';
import ExtraIncomePanel from './Partials/ExtraIncomePanel';
import IncomingCheques from './Partials/IncomingCheques';
import MaintenanceBillsPanel from './Partials/MaintenanceBillsPanel';
import OtherPaymentsPanel from './Partials/OtherPaymentsPanel';
import OutgoingAgreements from './Partials/OutgoingAgreements';
import PaymentSection, { SectionEmpty, SectionPart } from './Partials/PaymentSection';
import PaymentSideTabs from './Partials/PaymentSideTabs';
import PeriodSummary from './Partials/PeriodSummary';
import RentalReceipts from './Partials/RentalReceipts';
import ShortTermCollect from './Partials/ShortTermCollect';

/**
 * Named periods the filter offers, looking both back and ahead; any month
 * or range of days can be chosen too.
 */
const PERIOD_PRESETS = ['this_month', 'next_month', 'last_month', 'this_quarter', 'next_quarter', 'last_quarter', 'this_year', 'last_year'];

/**
 * How money is taken or paid on this page: cash stays with the camp boss,
 * a transfer or a cheque goes through the bank.
 */
const PAGE_METHODS = ['cash', 'bank_transfer', 'cheque'];

/**
 * A property's payments over a period, in and out, switched by two
 * buttons. Payments in come in three numbered sections, each with its own
 * figures: the contract cheques an admin follows until they are cashed,
 * with the extra income providers paid, always received;
 * what short-term rentals paid into the bank (transfers, and cheques once
 * submitted); and what they still owe, where a payment is recorded as
 * cash, a transfer or a cheque. Cash stays there with the camp boss until
 * an admin confirms receiving it; the rest moves to the bank section.
 * Payments out the same way round: the cheques to the landlord and the
 * maintenance contractors; bills paid by cheque or bank transfer; and
 * bills still to pay or paid in cash by the camp boss. Below both, the
 * period in short: the camp boss's cash to hand over, and the income,
 * expenses and profit.
 */
export default function Payments({
    property,
    period,
    tab: initialTab,
    incoming,
    outgoing,
    summary,
    can,
    chequeStatuses,
    banks,
    collectionMethods,
    billPaymentMethods,
    otherPaymentMethods,
    currency,
}) {
    const { t, tOr, formatDate } = useTranslation();
    const { range } = usePeriodLabel();
    const periodLabel = range(period);
    const [tab, setTab] = useState(initialTab);
    const type = property.type ? tOr(`propertyTypes.${property.typeSlug}`, property.type) : null;
    const place = [property.area, property.city].filter(Boolean).join(', ');
    const changePeriod = (value) =>
        router.get(
            route('properties.payments', property.id),
            { ...(value ? { period: value } : {}), ...(tab === 'out' ? { tab } : {}) },
            { preserveScroll: true, preserveState: true },
        );
    const { cheques, bank, cash, outBank, outCash } = summary;
    const chequeCount = (figure) => t('propertyPayments.figures.cheques', { count: figure.count });
    const receiptCount = (figure) => t('propertyPayments.figures.receipts', { count: figure.count });
    const pageMethods = (allowed) => PAGE_METHODS.filter((method) => allowed.includes(method));
    const outLists = ['bankBills', 'bankOthers', 'billsToPay', 'othersToPay', 'cashBills', 'cashOthers'];
    const counts = {
        in:
            incoming.contractCheques.length +
            incoming.extraIncome.length +
            incoming.rentalCheques.length +
            incoming.bankReceipts.length +
            incoming.cashReceipts.length,
        out: outLists.reduce((count, list) => count + outgoing[list].length, outgoing.agreements.length),
    };
    const collectProps = { rentals: incoming.rentals, currency, propertyId: property.id, period, periodLabel };
    const handoverButton = (size) =>
        can.confirmCash && (
            <CashHandoverButton
                receipts={incoming.cashReceipts}
                bills={outgoing.cashBills}
                others={outgoing.cashOthers}
                currency={currency}
                propertyId={property.id}
                size={size}
            />
        );
    const billLists = (bills, others, showHandover = false) => (
        <>
            <MaintenanceBillsPanel bills={bills} currency={currency} methods={pageMethods(billPaymentMethods)} showHandover={showHandover} />
            <OtherPaymentsPanel payments={others} currency={currency} methods={pageMethods(otherPaymentMethods)} showHandover={showHandover} />
        </>
    );

    return (
        <DashboardLayout>
            <Head title={`${t('propertyPayments.title')} · ${property.name}`} />

            <PageHeader
                breadcrumbs={[
                    { label: t('properties.title'), href: route('properties.index') },
                    { label: property.name, href: route('properties.show', property.id) },
                    { label: t('propertyPayments.title') },
                ]}
                title={t('propertyPayments.title')}
                description={[property.name, property.code, type, place].filter(Boolean).join(' · ')}
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.show', property.id)} />}>
                            <EyeIcon data-icon="inline-start" />
                            {t('propertyAllocation.viewProperty')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.allocation', property.id)} />}>
                            <LayoutPanelLeftIcon data-icon="inline-start" />
                            {t('properties.actions.allocation')}
                        </Button>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('properties.tenant-contracts', property.id)} />}>
                            <FileSignatureIcon data-icon="inline-start" />
                            {t('properties.actions.tenantContracts')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('maintenance.create', { property: property.id, from: 'payments' })} />}>
                            <WrenchIcon data-icon="inline-start" />
                            {t('propertyPayments.addMaintenance')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('other-payments.create', { property: property.id })} />}>
                            <ReceiptIcon data-icon="inline-start" />
                            {t('propertyPayments.addOtherPayment')}
                        </Button>
                        <Button variant="brand" nativeButton={false} render={<Link href={route('extra-incomes.create', { property: property.id, from: 'payments' })} />}>
                            <BadgePercentIcon data-icon="inline-start" />
                            {t('propertyPayments.addExtraIncome')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <Tabs value={tab} onValueChange={setTab} className="flex-col gap-6">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <PaymentSideTabs counts={counts} />
                        <PeriodFilter period={period} onChange={changePeriod} presets={PERIOD_PRESETS} allowsAll={false} />
                    </div>
                    <p className="text-[0.875rem] text-pretty text-muted-foreground">{t('propertyPayments.periodHint', { period: periodLabel })}</p>
                </div>

                <TabsContent value="in" className="flex flex-col gap-6">
                    <PaymentSection
                        number={1}
                        tone="brand"
                        icon={ScrollTextIcon}
                        title={t('propertyPayments.sections.cheques.title')}
                        owner={t('propertyPayments.owners.admin')}
                        description={t('propertyPayments.sections.cheques.description')}
                        currency={currency}
                        figures={[
                            {
                                icon: ScrollTextIcon,
                                tone: 'brand',
                                label: t('propertyPayments.figures.expected'),
                                amount: cheques.expected.amount,
                                detail: chequeCount(cheques.expected),
                            },
                            {
                                icon: CircleCheckIcon,
                                tone: 'success',
                                label: t('propertyPayments.figures.received'),
                                amount: cheques.received.amount,
                                detail: chequeCount(cheques.received),
                            },
                            {
                                icon: ClockIcon,
                                tone: 'gold',
                                label: t('propertyPayments.figures.pending'),
                                amount: cheques.waiting.amount,
                                detail: t('propertyPayments.figures.pendingDetail', { count: cheques.waiting.count, inHand: cheques.inHand.count }),
                            },
                            {
                                icon: Undo2Icon,
                                tone: 'danger',
                                label: t('propertyPayments.figures.failed'),
                                amount: cheques.failed.amount,
                                detail: chequeCount(cheques.failed),
                            },
                            {
                                icon: BadgePercentIcon,
                                tone: 'success',
                                label: t('propertyPayments.figures.extraIncome'),
                                amount: summary.extraIncome.amount,
                                detail: receiptCount(summary.extraIncome),
                            },
                        ]}
                    >
                        <SectionPart title={t('propertyPayments.sections.cheques.list')} count={incoming.contractCheques.length}>
                            <IncomingCheques
                                cheques={incoming.contractCheques}
                                statuses={chequeStatuses}
                                banks={banks}
                                currency={currency}
                                searchId="contract-cheques-search"
                                empty={{
                                    title: t('propertyPayments.sections.cheques.empty.title', { period: periodLabel }),
                                    description: t('propertyPayments.sections.cheques.empty.description'),
                                }}
                            />
                        </SectionPart>
                        <SectionPart title={t('propertyPayments.sections.cheques.extra')} count={incoming.extraIncome.length} hint={t('propertyPayments.sections.cheques.extraHint')}>
                            <ExtraIncomePanel
                                incomes={incoming.extraIncome}
                                currency={currency}
                                empty={t('propertyPayments.sections.cheques.extraEmpty', { period: periodLabel })}
                            />
                        </SectionPart>
                    </PaymentSection>

                    <PaymentSection
                        number={2}
                        tone="violet"
                        icon={LandmarkIcon}
                        title={t('propertyPayments.sections.bank.title')}
                        owner={t('propertyPayments.owners.campBoss')}
                        description={t('propertyPayments.sections.bank.description')}
                        currency={currency}
                        figures={[
                            {
                                icon: LandmarkIcon,
                                tone: 'success',
                                label: t('propertyPayments.figures.inBank'),
                                amount: bank.received,
                                detail: periodLabel,
                            },
                            {
                                icon: WalletIcon,
                                tone: 'brand',
                                label: t('propertyPayments.figures.transfers'),
                                amount: bank.transfers.amount,
                                detail: receiptCount(bank.transfers),
                            },
                            {
                                icon: CircleCheckIcon,
                                tone: 'brand',
                                label: t('propertyPayments.figures.chequesSubmitted'),
                                amount: bank.chequesCashed.amount,
                                detail: chequeCount(bank.chequesCashed),
                            },
                            {
                                icon: ClockIcon,
                                tone: 'gold',
                                label: t('propertyPayments.figures.chequesNotSubmitted'),
                                amount: bank.chequesWaiting.amount,
                                detail: [
                                    chequeCount(bank.chequesWaiting),
                                    bank.chequesFailed.count > 0 && t('propertyPayments.figures.bounced', { count: bank.chequesFailed.count }),
                                ]
                                    .filter(Boolean)
                                    .join(' · '),
                            },
                        ]}
                    >
                        <SectionPart
                            title={t('propertyPayments.sections.bank.cheques')}
                            count={incoming.rentalCheques.length}
                            hint={t('propertyPayments.sections.bank.chequesHint')}
                        >
                            <IncomingCheques
                                cheques={incoming.rentalCheques}
                                statuses={chequeStatuses}
                                banks={banks}
                                currency={currency}
                                searchId="rental-cheques-search"
                                settleAs="submitted"
                                groupNames={{
                                    in_hand: t('propertyPayments.sections.bank.groups.notSubmitted'),
                                    cleared: t('propertyPayments.sections.bank.groups.submitted'),
                                }}
                                empty={{
                                    title: t('propertyPayments.sections.bank.chequesEmpty.title', { period: periodLabel }),
                                    description: t('propertyPayments.sections.bank.chequesEmpty.description'),
                                }}
                            />
                        </SectionPart>
                        <SectionPart title={t('propertyPayments.sections.bank.receipts')} count={incoming.bankReceipts.length}>
                            <RentalReceipts
                                receipts={incoming.bankReceipts}
                                currency={currency}
                                empty={t('propertyPayments.sections.bank.receiptsEmpty', { period: periodLabel })}
                            />
                        </SectionPart>
                    </PaymentSection>

                    <PaymentSection
                        number={3}
                        tone="emerald"
                        icon={BanknoteIcon}
                        title={t('propertyPayments.sections.unpaid.title')}
                        owner={t('propertyPayments.owners.handover')}
                        description={t('propertyPayments.sections.unpaid.description')}
                        currency={currency}
                        actions={handoverButton()}
                        figures={[
                            {
                                icon: CircleAlertIcon,
                                tone: 'danger',
                                label: t('propertyPayments.figures.toCollect'),
                                amount: cash.toCollect,
                                detail: t('propertyPayments.figures.toCollectDetail', { count: cash.owing }),
                            },
                            {
                                icon: BanknoteIcon,
                                tone: 'brand',
                                label: t('propertyPayments.figures.collected'),
                                amount: cash.collected.amount,
                                detail: receiptCount(cash.collected),
                            },
                            {
                                icon: HandCoinsIcon,
                                tone: 'gold',
                                label: t('propertyPayments.figures.withCampBoss'),
                                amount: cash.withCampBoss.amount,
                                detail: t('propertyPayments.figures.withCampBossDetail', { count: cash.withCampBoss.count }),
                            },
                            {
                                icon: CircleCheckIcon,
                                tone: 'success',
                                label: t('propertyPayments.figures.handedOver'),
                                amount: cash.handedOver.amount,
                                detail: t('propertyPayments.figures.handedOverDetail'),
                            },
                        ]}
                    >
                        <SectionPart title={t('propertyPayments.sections.unpaid.collect')} count={cash.owing} hint={t('propertyPayments.sections.unpaid.collectHint')}>
                            <ShortTermCollect {...collectProps} methods={pageMethods(collectionMethods)} banks={banks} />
                        </SectionPart>
                        <SectionPart
                            title={t('propertyPayments.sections.unpaid.receipts')}
                            count={incoming.cashReceipts.length}
                            hint={!can.confirmCash && cash.withCampBoss.count > 0 ? t('propertyPayments.sections.unpaid.awaitingAdmin') : null}
                        >
                            <RentalReceipts
                                receipts={incoming.cashReceipts}
                                currency={currency}
                                showHandover
                                empty={t('propertyPayments.sections.unpaid.receiptsEmpty', { period: periodLabel })}
                            />
                        </SectionPart>
                    </PaymentSection>
                </TabsContent>

                <TabsContent value="out" className="flex flex-col gap-6">
                    <PaymentSection
                        number={1}
                        tone="gold"
                        icon={FileStackIcon}
                        title={t('propertyPayments.sections.agreements.title')}
                        owner={t('propertyPayments.owners.admin')}
                        description={t('propertyPayments.out.description')}
                        currency={currency}
                        figures={[
                            {
                                icon: CalendarClockIcon,
                                tone: 'gold',
                                label: t('propertyPayments.figures.dueBy', { date: formatDate(period.to) }),
                                amount: summary.agreements.due,
                                detail: t('propertyPayments.figures.dueByDetail'),
                            },
                            {
                                icon: CircleCheckIcon,
                                tone: 'success',
                                label: t('propertyPayments.figures.paid'),
                                amount: summary.agreements.paid,
                                detail: periodLabel,
                            },
                            {
                                icon: WalletIcon,
                                tone: 'muted',
                                label: t('propertyPayments.figures.leftOnAgreements'),
                                amount: summary.agreements.left,
                                detail: t('propertyPayments.figures.leftDetail'),
                            },
                        ]}
                    >
                        <OutgoingAgreements
                            agreements={outgoing.agreements}
                            currency={currency}
                            statuses={chequeStatuses}
                            banks={banks}
                            period={period}
                            periodLabel={periodLabel}
                        />
                    </PaymentSection>

                    <PaymentSection
                        number={2}
                        tone="violet"
                        icon={LandmarkIcon}
                        title={t('propertyPayments.sections.outBank.title')}
                        owner={t('propertyPayments.owners.admin')}
                        description={t('propertyPayments.sections.outBank.description')}
                        currency={currency}
                        figures={[
                            {
                                icon: LandmarkIcon,
                                tone: 'success',
                                label: t('propertyPayments.figures.paidFromBank'),
                                amount: outBank.paid.amount,
                                detail: t('propertyPayments.figures.payments', { count: outBank.paid.count }),
                            },
                            {
                                icon: WrenchIcon,
                                tone: 'brand',
                                label: t('propertyPayments.figures.maintenanceBills'),
                                amount: outBank.bills.amount,
                                detail: t('propertyPayments.figures.bills', { count: outBank.bills.count }),
                            },
                            {
                                icon: ReceiptIcon,
                                tone: 'brand',
                                label: t('propertyPayments.figures.otherPayments'),
                                amount: outBank.others.amount,
                                detail: t('propertyPayments.figures.payments', { count: outBank.others.count }),
                            },
                            {
                                icon: ScrollTextIcon,
                                tone: 'brand',
                                label: t('propertyPayments.figures.byCheque'),
                                amount: outBank.byCheque.amount,
                                detail: chequeCount(outBank.byCheque),
                            },
                        ]}
                    >
                        <SectionPart title={t('propertyPayments.sections.outBank.bills')} count={outgoing.bankBills.length}>
                            {outgoing.bankBills.length === 0 ? (
                                <SectionEmpty>{t('propertyPayments.sections.outBank.billsEmpty', { period: periodLabel })}</SectionEmpty>
                            ) : (
                                billLists(outgoing.bankBills, [])
                            )}
                        </SectionPart>
                        <SectionPart title={t('propertyPayments.sections.outBank.others')} count={outgoing.bankOthers.length}>
                            {outgoing.bankOthers.length === 0 ? (
                                <SectionEmpty>{t('propertyPayments.sections.outBank.othersEmpty', { period: periodLabel })}</SectionEmpty>
                            ) : (
                                billLists([], outgoing.bankOthers)
                            )}
                        </SectionPart>
                    </PaymentSection>

                    <PaymentSection
                        number={3}
                        tone="emerald"
                        icon={BanknoteIcon}
                        title={t('propertyPayments.sections.outCash.title')}
                        owner={t('propertyPayments.owners.campBoss')}
                        description={t('propertyPayments.sections.outCash.description')}
                        currency={currency}
                        figures={[
                            {
                                icon: CircleAlertIcon,
                                tone: 'danger',
                                label: t('propertyPayments.figures.stillToPay'),
                                amount: outCash.toPay.amount,
                                detail: t('propertyPayments.figures.bills', { count: outCash.toPay.count }),
                            },
                            {
                                icon: BanknoteIcon,
                                tone: 'brand',
                                label: t('propertyPayments.figures.paidInCash'),
                                amount: outCash.spent.amount,
                                detail: t('propertyPayments.figures.payments', { count: outCash.spent.count }),
                            },
                            {
                                icon: HandCoinsIcon,
                                tone: 'gold',
                                label: t('propertyPayments.figures.toSettle'),
                                amount: outCash.toSettle.amount,
                                detail: t('propertyPayments.figures.toSettleDetail'),
                            },
                            {
                                icon: ClockIcon,
                                tone: 'muted',
                                label: t('propertyPayments.figures.toCost'),
                                number: outCash.toCost,
                                detail: t('propertyPayments.figures.toCostDetail'),
                            },
                        ]}
                    >
                        <SectionPart
                            title={t('propertyPayments.sections.outCash.toPay')}
                            count={outgoing.billsToPay.length + outgoing.othersToPay.filter((payment) => payment.status === 'pending').length}
                            hint={t('propertyPayments.sections.outCash.toPayHint')}
                        >
                            {outgoing.billsToPay.length + outgoing.othersToPay.length === 0 ? (
                                <SectionEmpty>{t('propertyPayments.sections.outCash.toPayEmpty')}</SectionEmpty>
                            ) : (
                                billLists(outgoing.billsToPay, outgoing.othersToPay)
                            )}
                        </SectionPart>
                        <SectionPart title={t('propertyPayments.sections.outCash.paid')} count={outgoing.cashBills.length + outgoing.cashOthers.length}>
                            {outgoing.cashBills.length + outgoing.cashOthers.length === 0 ? (
                                <SectionEmpty>{t('propertyPayments.sections.outCash.paidEmpty', { period: periodLabel })}</SectionEmpty>
                            ) : (
                                billLists(outgoing.cashBills, outgoing.cashOthers, true)
                            )}
                        </SectionPart>
                    </PaymentSection>
                </TabsContent>

                <PeriodSummary summary={summary} periodLabel={periodLabel} currency={currency} handover={handoverButton('sm')} />
            </Tabs>
        </DashboardLayout>
    );
}
