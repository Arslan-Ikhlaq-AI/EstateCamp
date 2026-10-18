import ActionDialog from '@/Components/ActionDialog';
import { SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { InvoiceStatusBadge, PaymentStatusBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, useForm } from '@inertiajs/react';
import { BanIcon, ReceiptIcon } from 'lucide-react';
import { useState } from 'react';

function VoidDialog({ invoice, open, onOpenChange }) {
    const { t } = useTranslation();
    const form = useForm({});

    return (
        <ActionDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('leasing.invoices.void.title', { number: invoice.number })}
            description={t('leasing.invoices.void.description')}
            submitLabel={t('leasing.invoices.void.submit')}
            destructive
            processing={form.processing}
            onSubmit={() => form.post(route('invoices.void', invoice.id), { preserveScroll: true, onSuccess: () => onOpenChange(false) })}
        />
    );
}

function Totals({ rows }) {
    return (
        <dl className="ms-auto flex w-full max-w-xs flex-col gap-1.5 text-sm">
            {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                    <dt className={row.strong ? 'font-medium' : 'text-muted-foreground'}>{row.label}</dt>
                    <dd className={row.strong ? 'text-base font-semibold tabular-nums' : 'tabular-nums'}>{row.value}</dd>
                </div>
            ))}
        </dl>
    );
}

export default function Show({ invoice, items, allocations, company, currency }) {
    const { t, formatMoney, formatDate, formatNumber } = useTranslation();
    const { period } = useLeasingFormat();
    const [isVoiding, setIsVoiding] = useState(false);
    const isOpen = invoice.status !== 'void' && invoice.balance > 0;

    return (
        <DashboardLayout>
            <Head title={invoice.number} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.payments') }, { label: t('leasing.invoices.title'), href: route('invoices.index') }, { label: invoice.number }]}
                title={invoice.number}
                badge={<InvoiceStatusBadge status={invoice.status} isOverdue={invoice.isOverdue} />}
                description={
                    <span>
                        <Link href={route('clients.show', invoice.client.id)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                            {invoice.client.name}
                        </Link>{' '}
                        ·{' '}
                        <Link href={route('contracts.show', invoice.contract.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                            {invoice.contract.number}
                        </Link>
                    </span>
                }
                actions={
                    <>
                        {invoice.canVoid && (
                            <Button variant="outline" onClick={() => setIsVoiding(true)}>
                                <BanIcon data-icon="inline-start" />
                                {t('leasing.invoices.void.button')}
                            </Button>
                        )}
                        {isOpen && (
                            <Button nativeButton={false} render={<Link href={route('payments.create', { client: invoice.client.id, invoice: invoice.id })} />}>
                                <ReceiptIcon data-icon="inline-start" />
                                {t('leasing.payments.add')}
                            </Button>
                        )}
                    </>
                }
            />

            <FlashMessages errorKeys={['invoice']} />

            <div className="flex max-w-4xl flex-col gap-6">
                <Card>
                    <CardContent className="flex flex-col gap-6">
                        <div className="flex flex-col justify-between gap-6 sm:flex-row">
                            <div className="flex flex-col gap-1 text-sm">
                                {company.logo_url && <img src={company.logo_url} alt="" className="mb-2 h-10 w-auto self-start" />}
                                <span className="font-semibold">{company.legal_name ?? company.name}</span>
                                {[company.address_line_1, company.address_line_2, company.city].filter(Boolean).map((line) => (
                                    <span key={line} className="text-muted-foreground">
                                        {line}
                                    </span>
                                ))}
                                {company.tax_registration_number && <span className="text-muted-foreground">{t('leasing.invoices.show.trn', { number: company.tax_registration_number })}</span>}
                            </div>
                            <div className="flex flex-col gap-1 text-sm sm:text-end">
                                <span className="text-xs tracking-wide text-muted-foreground uppercase">{t('leasing.invoices.show.billTo')}</span>
                                <span className="font-semibold" dir="auto">{invoice.client.name}</span>
                                {invoice.client.address && <span className="text-muted-foreground">{invoice.client.address}</span>}
                                {invoice.client.email && <span className="text-muted-foreground">{invoice.client.email}</span>}
                                {invoice.client.tax_registration_number && (
                                    <span className="text-muted-foreground">{t('leasing.invoices.show.trn', { number: invoice.client.tax_registration_number })}</span>
                                )}
                            </div>
                        </div>

                        <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-4">
                            {[
                                { label: t('leasing.invoices.show.issued'), value: formatDate(invoice.issueDate) },
                                { label: t('leasing.invoices.columns.due'), value: formatDate(invoice.dueDate) },
                                { label: t('leasing.invoices.columns.period'), value: period(invoice.periodStart, invoice.periodEnd) },
                                { label: t('leasing.contracts.columns.contract'), value: invoice.contract.number },
                            ].map((row) => (
                                <div key={row.label} className="flex flex-col gap-0.5">
                                    <dt className="text-xs text-muted-foreground">{row.label}</dt>
                                    <dd className="font-medium">{row.value}</dd>
                                </div>
                            ))}
                        </dl>

                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>{t('leasing.invoices.show.description')}</TableHead>
                                    <TableHead className="text-end">{t('leasing.invoices.show.quantity')}</TableHead>
                                    <TableHead className="text-end">{t('leasing.invoices.show.unitPrice')}</TableHead>
                                    <TableHead className="text-end">{t('leasing.invoices.show.vat')}</TableHead>
                                    <TableHead className="text-end">{t('leasing.common.amount')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="whitespace-normal">{item.description}</TableCell>
                                        <TableCell className="text-end tabular-nums">{formatNumber(item.quantity)}</TableCell>
                                        <TableCell className="text-end tabular-nums">{formatMoney(item.unitPrice, currency)}</TableCell>
                                        <TableCell className="text-end tabular-nums">{item.vatRate > 0 ? `${formatNumber(item.vatRate)}%` : '—'}</TableCell>
                                        <TableCell className="text-end font-medium tabular-nums">{formatMoney(item.amount, currency)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <Separator />

                        <Totals
                            rows={[
                                { label: t('leasing.invoices.show.subtotal'), value: formatMoney(invoice.subtotal, currency) },
                                { label: t('leasing.invoices.show.vatTotal'), value: formatMoney(invoice.vatAmount, currency) },
                                { label: t('leasing.invoices.columns.total'), value: formatMoney(invoice.total, currency), strong: true },
                                { label: t('leasing.invoices.show.paid'), value: formatMoney(invoice.amountPaid, currency) },
                                { label: t('leasing.invoices.columns.balance'), value: formatMoney(invoice.balance, currency), strong: true },
                            ]}
                        />
                    </CardContent>
                </Card>

                <SectionCard title={t('leasing.invoices.show.payments')} description={t('leasing.invoices.show.paymentsDescription')}>
                    {allocations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('leasing.invoices.show.noPayments')}</p>
                    ) : (
                        <ul className="flex flex-col divide-y">
                            {allocations.map((allocation) => (
                                <li key={allocation.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                                    <div className="flex flex-col">
                                        <Link href={route('payments.show', allocation.payment.id)} className="text-sm font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                            {allocation.payment.number}
                                        </Link>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDate(allocation.payment.receivedOn)} · {t(`leasing.methods.${allocation.payment.method}`)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {allocation.payment.status !== 'cleared' && <PaymentStatusBadge status={allocation.payment.status} />}
                                        <span className="text-sm font-medium tabular-nums">{formatMoney(allocation.amount, currency)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </SectionCard>

                {invoice.notes && (
                    <SectionCard title={t('leasing.common.notes')}>
                        <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{invoice.notes}</p>
                    </SectionCard>
                )}
            </div>

            {isVoiding && <VoidDialog invoice={invoice} open onOpenChange={(open) => !open && setIsVoiding(false)} />}
        </DashboardLayout>
    );
}
