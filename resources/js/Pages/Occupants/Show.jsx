import DataTable from '@/Components/DataTable';
import { DetailList, SectionCard } from '@/Components/DetailCards';
import FlashMessages from '@/Components/FlashMessages';
import { ToneBadge } from '@/Components/LeasingBadges';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useLeasingFormat } from '@/hooks/use-leasing-format';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import { DoorClosedIcon, LogInIcon, LogOutIcon, PencilIcon, UserCheckIcon } from 'lucide-react';
import { useState } from 'react';
import CheckOutDialog from './Partials/CheckOutDialog';

export default function Show({ occupant, stays }) {
    const { t, formatDate, formatNumber } = useTranslation();
    const { period } = useLeasingFormat();
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const current = stays.find((stay) => stay.checkOutDate === null);
    const history = stays.filter((stay) => stay.checkOutDate !== null);

    return (
        <DashboardLayout>
            <Head title={occupant.name} />

            <PageHeader
                breadcrumbs={[{ label: t('nav.tenants') }, { label: t('leasing.occupants.title'), href: route('occupants.index') }, { label: occupant.name }]}
                title={occupant.name}
                badge={
                    current ? (
                        <ToneBadge tone="success" icon={UserCheckIcon}>
                            {t('leasing.occupants.status.staying')}
                        </ToneBadge>
                    ) : (
                        <ToneBadge tone="muted">{t('leasing.occupants.notStaying')}</ToneBadge>
                    )
                }
                description={
                    <span>
                        <Link href={route('clients.show', occupant.client.id)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                            {occupant.client.name}
                        </Link>
                        {occupant.employeeNumber && ` · ${occupant.employeeNumber}`}
                    </span>
                }
                actions={
                    <>
                        <Button variant="outline" nativeButton={false} render={<Link href={route('occupants.edit', occupant.id)} />}>
                            <PencilIcon data-icon="inline-start" />
                            {t('leasing.common.edit')}
                        </Button>
                        {current ? (
                            <Button onClick={() => setIsCheckingOut(true)}>
                                <LogOutIcon data-icon="inline-start" />
                                {t('leasing.occupants.checkOut.button')}
                            </Button>
                        ) : (
                            <Button nativeButton={false} render={<Link href={route('occupancies.create', { occupant: occupant.id })} />}>
                                <LogInIcon data-icon="inline-start" />
                                {t('leasing.checkIn.button')}
                            </Button>
                        )}
                    </>
                }
            />

            <FlashMessages />

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <SectionCard title={t('leasing.occupants.show.currentStay')}>
                        {current ? (
                            <DetailList
                                rows={[
                                    { label: t('leasing.common.property'), value: <span dir="auto">{current.property.name}</span> },
                                    { label: t('leasing.occupants.columns.room'), value: t('leasing.lines.roomName', { room: current.roomNumber }) },
                                    { label: t('leasing.occupants.columns.since'), value: formatDate(current.checkInDate) },
                                    { label: t('leasing.occupants.show.nights'), value: formatNumber(current.nights) },
                                    current.contract
                                        ? {
                                              label: t('leasing.contracts.columns.contract'),
                                              value: (
                                                  <Link href={route('contracts.show', current.contract.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                                      {current.contract.number}
                                                  </Link>
                                              ),
                                          }
                                        : {
                                              label: t('finance.rentals.show.rental'),
                                              value: (
                                                  <Link href={route('rentals.show', current.rental.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                                      {current.rental.rental_number}
                                                  </Link>
                                              ),
                                          },
                                ]}
                            />
                        ) : (
                            <Empty className="py-6">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <DoorClosedIcon />
                                    </EmptyMedia>
                                    <EmptyTitle>{t('leasing.occupants.show.noStayTitle')}</EmptyTitle>
                                    <EmptyDescription>{t('leasing.occupants.show.noStayDescription')}</EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    <Button nativeButton={false} render={<Link href={route('occupancies.create', { occupant: occupant.id })} />}>
                                        <LogInIcon data-icon="inline-start" />
                                        {t('leasing.checkIn.button')}
                                    </Button>
                                </EmptyContent>
                            </Empty>
                        )}
                    </SectionCard>

                    <SectionCard title={t('leasing.occupants.show.history')} description={t('leasing.occupants.show.historyDescription')} flush>
                        {history.length === 0 ? (
                            <p className="px-4 py-5 text-sm text-muted-foreground sm:px-5 lg:px-6">{t('leasing.occupants.show.noHistory')}</p>
                        ) : (
                            <DataTable
                                rows={history}
                                columns={[
                                    {
                                        id: 'room',
                                        header: t('leasing.occupants.columns.room'),
                                        cell: (stay) => (
                                            <div className="flex flex-col text-sm">
                                                <span>{t('leasing.lines.roomName', { room: stay.roomNumber })}</span>
                                                <span className="text-xs text-muted-foreground" dir="auto">{stay.property.name}</span>
                                            </div>
                                        ),
                                    },
                                    {
                                        id: 'contract',
                                        header: t('leasing.contracts.columns.contract'),
                                        cell: (stay) =>
                                            stay.contract ? (
                                                <Link href={route('contracts.show', stay.contract.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                                    {stay.contract.number}
                                                </Link>
                                            ) : (
                                                <Link href={route('rentals.show', stay.rental.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                                    {stay.rental.rental_number}
                                                </Link>
                                            ),
                                    },
                                    { id: 'dates', header: t('leasing.occupants.columns.stayed'), cell: (stay) => <span className="text-sm">{period(stay.checkInDate, stay.checkOutDate)}</span> },
                                    { id: 'nights', header: t('leasing.occupants.show.nights'), align: 'end', cell: (stay) => <span className="tabular-nums">{formatNumber(stay.nights)}</span> },
                                ]}
                            />
                        )}
                    </SectionCard>
                </div>

                <div className="flex flex-col gap-6">
                    <SectionCard title={t('leasing.occupants.show.details')}>
                        <DetailList
                            columns={1}
                            rows={[
                                {
                                    label: t('leasing.occupants.columns.client'),
                                    value: (
                                        <Link href={route('clients.show', occupant.client.id)} className="underline-offset-4 hover:text-brand-ink hover:underline" dir="auto">
                                            {occupant.client.name}
                                        </Link>
                                    ),
                                },
                                { label: t('leasing.occupants.columns.gender'), value: t(`gender.${occupant.gender}`) },
                                { label: t('leasing.clients.form.fields.nationality'), value: occupant.nationality },
                                {
                                    label: occupant.idType ? t(`leasing.idTypes.${occupant.idType}`) : t('leasing.clients.form.fields.idNumber'),
                                    value: occupant.idNumber && <span className="font-mono">{occupant.idNumber}</span>,
                                },
                                { label: t('leasing.clients.form.fields.phone'), value: occupant.phone },
                                { label: t('leasing.occupants.form.fields.employeeNumber'), value: occupant.employeeNumber },
                            ]}
                        />
                    </SectionCard>

                    {occupant.notes && (
                        <SectionCard title={t('leasing.common.notes')}>
                            <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">{occupant.notes}</p>
                        </SectionCard>
                    )}
                </div>
            </div>

            {isCheckingOut && current && (
                <CheckOutDialog stay={{ ...current, occupantName: occupant.name }} open onOpenChange={(open) => !open && setIsCheckingOut(false)} />
            )}
        </DashboardLayout>
    );
}
