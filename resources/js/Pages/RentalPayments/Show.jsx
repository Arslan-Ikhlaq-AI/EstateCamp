import { ReceiptStatusBadge, useRentalPlace } from '@/Components/FinanceBadges';
import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import PrintableDocument, { DocumentAmount, DocumentFacts } from '@/Components/PrintableDocument';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, BanIcon, PrinterIcon } from 'lucide-react';
import { useState } from 'react';
import { VoidReceiptDialog } from '../Rentals/Partials/RentalDialogs';

/**
 * A tenant's receipt, ready to print or hand over: who paid, what for,
 * how, and how far their rent is paid after it.
 */
export default function Show({ payment, rental, company, currency }) {
    const { t, formatMoney, formatDate } = useTranslation();
    const { period } = useLeasingFormat();
    const place = useRentalPlace();
    const [isVoiding, setIsVoiding] = useState(false);
    const isVoid = payment.status === 'void';
    const forWhat = payment.periodStart ? `${t(`finance.receipts.purposes.${payment.purpose}`)} · ${period(payment.periodStart, payment.periodEnd)}` : t(`finance.receipts.purposes.${payment.purpose}`);

    return (
        <DashboardLayout>
            <Head title={payment.number} />

            <div className="print:hidden">
                <PageHeader
                    breadcrumbs={[{ label: t('nav.payments') }, { label: t('finance.receipts.title'), href: route('rental-payments.index') }, { label: payment.number }]}
                    title={payment.number}
                    badge={<ReceiptStatusBadge status={payment.status} />}
                    description={t('finance.receipts.show.description', { name: rental.client.name, rental: rental.number })}
                    actions={
                        <>
                            <Button variant="outline" nativeButton={false} render={<Link href={route('rentals.show', rental.id)} />}>
                                <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
                                {t('finance.receipts.show.openRental')}
                            </Button>
                            {payment.canVoid && (
                                <Button variant="outline" onClick={() => setIsVoiding(true)}>
                                    <BanIcon data-icon="inline-start" />
                                    {t('finance.receipts.actions.void')}
                                </Button>
                            )}
                            <Button onClick={() => window.print()}>
                                <PrinterIcon data-icon="inline-start" />
                                {t('finance.documents.print')}
                            </Button>
                        </>
                    }
                />
            </div>

            <div className="print:hidden">
                <FlashMessages errorKeys={['reason']} />
            </div>

            <PrintableDocument
                company={company}
                title={t('finance.receipts.show.documentTitle')}
                number={payment.number}
                date={formatDate(payment.paidOn)}
                isVoid={isVoid}
                voidNote={isVoid ? t('finance.receipts.show.voidNote', { date: formatDate(payment.voidedOn), reason: payment.voidReason ?? '—' }) : null}
                signatures={[
                    { label: t('finance.receipts.show.receivedBy'), name: payment.receivedBy ?? company.name },
                    { label: t('finance.receipts.show.tenantSignature'), name: rental.client.name },
                ]}
            >
                <DocumentFacts
                    rows={[
                        { label: t('finance.receipts.show.receivedFrom'), value: rental.client.name },
                        { label: t('finance.rentals.form.idNumber'), value: rental.client.id_number ? `${t(`leasing.idTypes.${rental.client.id_type}`)} · ${rental.client.id_number}` : null },
                        { label: t('finance.receipts.show.rental'), value: `${rental.number} · ${place(rental)}` },
                        { label: t('finance.receipts.show.property'), value: rental.property?.name },
                        { label: t('finance.receipts.show.method'), value: t(`leasing.methods.${payment.method}`) },
                        {
                            label: payment.cheque ? t('finance.receipts.show.cheque') : t('finance.receipts.show.reference'),
                            value: payment.cheque ? `${payment.cheque.number} · ${payment.cheque.bank} · ${formatDate(payment.cheque.date)}` : payment.reference,
                        },
                    ]}
                />

                <DocumentAmount label={t('finance.receipts.show.amountReceived')} amount={formatMoney(payment.amount, currency)} detail={forWhat} />

                {!isVoid && payment.purpose === 'rent' && (
                    <p className="text-sm text-muted-foreground">
                        {rental.standing.paidThrough
                            ? t('finance.receipts.show.paidThrough', { date: formatDate(rental.standing.paidThrough) })
                            : t('finance.receipts.show.partial')}
                        {rental.standing.arrears > 0 && ` ${t('finance.receipts.show.stillOwed', { amount: formatMoney(rental.standing.arrears, currency) })}`}
                    </p>
                )}

                {payment.notes && (
                    <p dir="auto" className="text-sm whitespace-pre-line">
                        {payment.notes}
                    </p>
                )}
            </PrintableDocument>

            {isVoiding && <VoidReceiptDialog payment={payment} currency={currency} open onOpenChange={(open) => !open && setIsVoiding(false)} />}
        </DashboardLayout>
    );
}
