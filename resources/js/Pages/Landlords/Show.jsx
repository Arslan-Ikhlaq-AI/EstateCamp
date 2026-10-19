import { ChequeList } from '@/Components/ChequeSchedule';
import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { LeaseStatusBadge, PartyTypeBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { FileSignatureIcon, PencilIcon } from 'lucide-react';

export default function Show({ landlord, leases, upcomingCheques, chequeTotals, currency }) {
    const { t, formatCurrency } = useTranslation();
    const { period } = useLeasingFormat();
    const isCompany = landlord.landlord_type === 'company';

    return (
        <DashboardLayout>
            <Head title={landlord.name} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.landlordsMenu') }, { label: t('leasing.landlords.title'), href: route('landlords.index') }, { label: landlord.name }]}
                title={landlord.name}
                badge={<PartyTypeBadge type={landlord.landlord_type} />}
                description={landlord.contact_person_name}
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('landlords.edit', landlord.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('leasing.common.edit')}
                        </Button>
                        <Button nativeButton={false} render={<Link href={route('head-leases.create', { landlord: landlord.id })} />}>
                            <FileSignatureIcon data-icon="inline-start" />
                            {t('leasing.landlords.newLease')}
                        </Button>
                    </>
                }
            />

            <FlashMessages />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard title={t('leasing.landlords.show.leases')} description={t('leasing.landlords.show.leasesDescription')} flush>
                        {leases.length === 0 ? (
                            <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 lg:px-6">{t('leasing.landlords.show.noLeases')}</p>
                        ) : (
                            <DataTable
                                rows={leases}
                                columns={[
                                    {
                                        id: 'number',
                                        header: t('leasing.headLeases.columns.lease'),
                                        cell: (lease) => (
                                            <Link href={route('head-leases.show', lease.id)} className="font-medium underline-offset-4 hover:text-brand-ink hover:underline">
                                                {lease.number}
                                            </Link>
                                        ),
                                    },
                                    { id: 'property', header: t('leasing.headLeases.columns.property'), cell: (lease) => <span dir="auto">{lease.property.name}</span> },
                                    { id: 'term', header: t('leasing.headLeases.columns.term'), cell: (lease) => <span className="text-sm">{period(lease.startDate, lease.endDate)}</span> },
                                    {
                                        id: 'rent',
                                        header: t('leasing.headLeases.columns.annualRent'),
                                        align: 'end',
                                        cell: (lease) => <span className="tabular-nums">{formatCurrency(lease.annualRent, currency)}</span>,
                                    },
                                    { id: 'status', header: t('leasing.headLeases.columns.status'), cell: (lease) => <LeaseStatusBadge status={lease.status} /> },
                                ]}
                            />
                        )}
                    </SectionCard>

                    <SectionCard title={t('leasing.landlords.show.details')}>
                        <DetailList
                            rows={[
                                { label: t('leasing.landlords.form.fields.contactPerson'), value: landlord.contact_person_name },
                                { label: t('leasing.landlords.form.fields.phone'), value: landlord.phone },
                                { label: t('leasing.landlords.form.fields.email'), value: landlord.email },
                                isCompany
                                    ? { label: t('leasing.landlords.form.fields.tradeLicense'), value: landlord.trade_license_number }
                                    : { label: t('leasing.landlords.form.fields.idNumber'), value: landlord.id_number },
                                { label: t('leasing.landlords.form.fields.trn'), value: landlord.tax_registration_number },
                                { label: t('leasing.landlords.form.fields.address'), value: landlord.address },
                            ]}
                        />
                    </SectionCard>

                    {landlord.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{landlord.notes}</p>
                        </SectionCard>
                    )}
                </div>

                <div className="flex flex-col gap-6">
                    <SectionCard
                        title={t('leasing.landlords.show.upcoming')}
                        description={t('leasing.landlords.show.upcomingDescription')}
                        action={
                            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={route('cheques.index', { direction: ['issued'], search: landlord.name })} />}>
                                {t('leasing.cheques.upcoming.viewAll')}
                            </Button>
                        }
                    >
                        <div className="flex flex-col gap-4">
                            <dl className="grid grid-cols-2 gap-2.5">
                                <div className="flex flex-col gap-0.5 rounded-xl bg-success/[0.06] px-3 py-2.5 ring-1 ring-success/20">
                                    <dt className="text-xs text-muted-foreground">{t('leasing.cheques.party.paidThisYear')}</dt>
                                    <dd className="font-heading text-base font-bold tabular-nums">{formatCurrency(chequeTotals.paidThisYear, currency)}</dd>
                                </div>
                                <div className="flex flex-col gap-0.5 rounded-xl bg-muted/50 px-3 py-2.5 ring-1 ring-foreground/[0.06]">
                                    <dt className="text-xs text-muted-foreground">{t('leasing.cheques.party.toPay')}</dt>
                                    <dd className="font-heading text-base font-bold tabular-nums">{formatCurrency(chequeTotals.toPay, currency)}</dd>
                                </div>
                            </dl>
                            {(chequeTotals.toWrite > 0 || chequeTotals.bounced > 0) && (
                                <p className="text-[0.8125rem] font-medium text-warning">
                                    {[
                                        chequeTotals.toWrite > 0 && t('leasing.cheques.party.toWrite', { count: chequeTotals.toWrite }),
                                        chequeTotals.bounced > 0 && t('leasing.cheques.party.bounced', { count: chequeTotals.bounced }),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            )}
                            <ChequeList cheques={upcomingCheques} currency={currency} empty={t('leasing.landlords.stats.nothingDue')} />
                        </div>
                    </SectionCard>

                    <SectionCard title={t('leasing.landlords.form.bank.title')}>
                        <DetailList
                            columns={1}
                            rows={[
                                { label: t('leasing.landlords.form.fields.bankName'), value: landlord.bank_name },
                                { label: t('leasing.landlords.form.fields.accountName'), value: landlord.account_name },
                                { label: t('leasing.landlords.form.fields.iban'), value: landlord.iban && <span className="font-mono">{landlord.iban}</span> },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>
        </DashboardLayout>
    );
}
