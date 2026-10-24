import PageHeader from '@/Components/PageHeader';
import PrintableDocument, { DocumentAmount, DocumentFacts } from '@/Components/PrintableDocument';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftIcon, ExternalLinkIcon, PrinterIcon } from 'lucide-react';

/**
 * The payment voucher of a paid maintenance bill: who was paid, for which
 * job, how, and lines for whoever prepared, approved and received it.
 */
export default function Voucher({ bill, company, currency }) {
    const { t, formatMoney, formatDate, tOr } = useTranslation();
    const where = [bill.property?.name, bill.unit && t(`finance.bills.units.${bill.unit.type}`, { number: bill.unit.number ?? '—' }), bill.location].filter(Boolean).join(' · ');

    return (
        <DashboardLayout>
            <Head title={bill.voucherNumber ?? bill.number} />

            <div className="print:hidden">
                <PageHeader
                    breadcrumbs={[{ label: t('nav.payments') }, { label: t('finance.bills.title'), href: route('maintenance-bills.index') }, { label: bill.voucherNumber ?? bill.number }]}
                    title={bill.voucherNumber ?? bill.number}
                    description={t('finance.bills.voucher.description', { job: bill.number })}
                    actions={
                        <>
                            <Button variant="outline" nativeButton={false} render={<Link href={route('maintenance.show', bill.id)} />}>
                                <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
                                {t('finance.bills.actions.job')}
                            </Button>
                            {bill.invoiceUrl && (
                                <Button variant="outline" nativeButton={false} render={<a href={bill.invoiceUrl} target="_blank" rel="noreferrer" />}>
                                    <ExternalLinkIcon data-icon="inline-start" />
                                    {t('finance.bills.actions.invoice')}
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

            <PrintableDocument
                company={company}
                title={t('finance.bills.voucher.documentTitle')}
                number={bill.voucherNumber ?? '—'}
                date={formatDate(bill.paidOn)}
                signatures={[
                    { label: t('finance.bills.voucher.preparedBy'), name: bill.paidBy },
                    { label: t('finance.bills.voucher.approvedBy') },
                    { label: t('finance.bills.voucher.receivedBy'), name: bill.vendor },
                ]}
            >
                <DocumentFacts
                    rows={[
                        { label: t('finance.bills.voucher.paidTo'), value: [bill.vendor, bill.vendorPhone].filter(Boolean).join(' · ') || t('finance.bills.noVendor') },
                        { label: t('finance.bills.voucher.vendorInvoice'), value: bill.invoiceNumber },
                        { label: t('finance.bills.voucher.job'), value: `${bill.number} · ${bill.title}` },
                        { label: t('finance.bills.voucher.kind'), value: bill.category ? tOr(`maintenance.categoryNames.${bill.category.slug}`, bill.category.name) : null },
                        { label: t('finance.bills.columns.where'), value: where },
                        { label: t('finance.bills.voucher.finished'), value: bill.completedOn ? formatDate(bill.completedOn) : null },
                        { label: t('finance.bills.pay.method'), value: bill.paymentMethod ? t(`leasing.methods.${bill.paymentMethod}`) : null },
                        { label: t('finance.bills.pay.reference'), value: bill.paymentReference },
                    ]}
                />

                <DocumentAmount label={t('finance.bills.voucher.amountPaid')} amount={formatMoney(bill.amount, currency)} detail={bill.title} />

                {bill.description && (
                    <p dir="auto" className="text-sm whitespace-pre-line text-muted-foreground">
                        {bill.description}
                    </p>
                )}
            </PrintableDocument>
        </DashboardLayout>
    );
}
