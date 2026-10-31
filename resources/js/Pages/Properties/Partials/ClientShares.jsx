import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Building2Icon, ChevronRightIcon, DoorOpenIcon, FilePlusIcon, HouseIcon, StoreIcon, UserIcon, UsersIcon } from 'lucide-react';

/**
 * The first three clients keep their own colour; the rest fold into one
 * grey "other clients" share, so the bar never needs a fourth hue.
 */
const SHARE_COLOURS = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3'];
const OTHER_COLOUR = 'bg-chart-3';

/**
 * The property's rooms as one bar split by client, with the rooms nobody
 * rents left as track, and a legend naming each share.
 */
function RoomShares({ clients, totalRooms }) {
    const { t, formatNumber } = useTranslation();
    const holding = clients.filter((client) => client.rooms > 0);
    const named = holding.slice(0, SHARE_COLOURS.length).map((client, index) => ({ key: client.id, label: client.name, rooms: client.rooms, colour: SHARE_COLOURS[index] }));
    const otherRooms = holding.slice(SHARE_COLOURS.length).reduce((sum, client) => sum + client.rooms, 0);
    const shares = otherRooms > 0 ? [...named, { key: 'other', label: t('propertyShow.clients.otherClients'), rooms: otherRooms, colour: OTHER_COLOUR }] : named;
    const free = Math.max(totalRooms - holding.reduce((sum, client) => sum + client.rooms, 0), 0);

    if (totalRooms === 0 || shares.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3">
            <div
                role="img"
                aria-label={shares.map((share) => `${share.label}: ${t('common.rooms', { count: share.rooms })}`).join(', ')}
                className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
            >
                {shares.map((share) => (
                    <span key={share.key} className={cn('h-full first:rounded-s-full', share.colour)} style={{ width: `${(share.rooms / totalRooms) * 100}%` }} />
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                {shares.map((share) => (
                    <li key={share.key} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className={cn('size-2.5 rounded-full', share.colour)} />
                        <span dir="auto" className="font-medium">{share.label}</span>
                        <span className="text-muted-foreground tabular-nums">{formatNumber(share.rooms)}</span>
                    </li>
                ))}
                <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2.5 rounded-full bg-muted inset-ring inset-ring-foreground/15" />
                    <span className="font-medium">{t('propertyShow.clients.free')}</span>
                    <span className="text-muted-foreground tabular-nums">{formatNumber(free)}</span>
                </li>
            </ul>
        </div>
    );
}

/**
 * One count a client holds, linking to that list filtered to the client
 * and the property.
 */
function HoldingLink({ icon: Icon, label, href }) {
    return (
        <Link
            href={href}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 text-xs font-medium transition-colors hover:bg-accent hover:text-brand-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
            <Icon className="size-3.5 text-muted-foreground" />
            {label}
            <ChevronRightIcon className="size-3 text-muted-foreground rtl:rotate-180" />
        </Link>
    );
}

/**
 * Who rents what in the property: the rooms split by client, then each
 * client with their contracts, what they hold (each linking to the list
 * filtered to them) and their monthly value.
 */
export default function ClientShares({ property, clients, currency }) {
    const { t, formatNumber, formatCurrency } = useTranslation();

    if (clients.length === 0) {
        return (
            <Empty className="border border-dashed py-10">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <UsersIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('propertyShow.clients.empty')}</EmptyTitle>
                    <EmptyDescription>{t('propertyShow.clients.emptyDescription')}</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button variant="outline" nativeButton={false} render={<Link href={route('contracts.create')} />}>
                        <FilePlusIcon data-icon="inline-start" />
                        {t('propertyShow.newContract')}
                    </Button>
                </EmptyContent>
            </Empty>
        );
    }

    const filter = (client) => ({ properties: [property.code], clients: [client.id] });

    return (
        <div className="flex flex-col gap-5">
            <RoomShares clients={clients} totalRooms={property.roomOccupancy.total} />

            <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/[0.08]">
                {clients.map((client) => (
                    <li key={client.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/20 dark:text-brand-cyan">
                                {client.type === 'individual' ? <UserIcon className="size-4.5" /> : <Building2Icon className="size-4.5" />}
                            </span>
                            <div className="flex min-w-0 flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <Link href={route('clients.show', client.id)} dir="auto" className="truncate text-sm font-semibold hover:text-brand-ink">
                                        {client.name}
                                    </Link>
                                    {client.contracts.map((contract) => (
                                        <Badge
                                            key={contract.id}
                                            variant={contract.status === 'active' ? 'info' : 'secondary'}
                                            render={<Link href={route('contracts.show', contract.id)} />}
                                        >
                                            {contract.number}
                                            {contract.status !== 'active' && ` · ${t(`leasing.status.contract.${contract.status}`)}`}
                                        </Badge>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {client.rooms > 0 && (
                                        <HoldingLink icon={DoorOpenIcon} label={t('propertyShow.clients.rooms', { count: client.rooms })} href={route('rooms.index', filter(client))} />
                                    )}
                                    {client.shops > 0 && (
                                        <HoldingLink icon={StoreIcon} label={t('propertyShow.clients.shops', { count: client.shops })} href={route('shops.index', filter(client))} />
                                    )}
                                    {client.apartments > 0 && (
                                        <HoldingLink
                                            icon={HouseIcon}
                                            label={t('propertyShow.clients.apartments', { count: client.apartments })}
                                            href={route('apartments.index', filter(client))}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-end sm:gap-0.5">
                            <span className="text-sm font-bold tabular-nums">{formatCurrency(client.monthly, currency)}</span>
                            <span className="text-xs text-muted-foreground">{t('propertyShow.clients.perMonth')}</span>
                        </div>
                    </li>
                ))}
            </ul>
            <p className="text-xs text-muted-foreground">
                {t('propertyShow.clients.summary', { count: clients.length, rooms: formatNumber(clients.reduce((sum, client) => sum + client.rooms, 0)) })}
            </p>
        </div>
    );
}
