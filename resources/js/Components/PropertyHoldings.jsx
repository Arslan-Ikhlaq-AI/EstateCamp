import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { Building2Icon, DoorOpenIcon, HouseIcon, StoreIcon } from 'lucide-react';

const UNIT_ICONS = { room: DoorOpenIcon, apartment: HouseIcon, shop: StoreIcon };

/**
 * How many rooms, apartments and shops a set of contract lines rents, and
 * how many people the rooms sleep.
 *
 * @return {{ properties: number, rooms: number, capacity: number, apartments: number, shops: number }}
 */
export function holdingTotals(lines) {
    return {
        properties: new Set(lines.map((line) => line.property.id)).size,
        rooms: new Set(lines.filter((line) => line.roomId).map((line) => line.roomId)).size,
        capacity: lines.reduce((sum, line) => sum + (line.capacity ?? 0), 0),
        apartments: lines.filter((line) => line.unitType === 'apartment').length,
        shops: lines.filter((line) => line.unitType === 'shop').length,
    };
}

/**
 * The totals in words, leaving out kinds there are none of.
 */
export function useHoldingSummary() {
    const { t } = useTranslation();

    return (totals) =>
        [
            totals.rooms > 0 && t('propertyShow.clients.rooms', { count: totals.rooms }),
            totals.capacity > 0 && t('common.sleeps', { count: totals.capacity }),
            totals.apartments > 0 && t('propertyShow.clients.apartments', { count: totals.apartments }),
            totals.shops > 0 && t('propertyShow.clients.shops', { count: totals.shops }),
        ]
            .filter(Boolean)
            .join(' · ');
}

/**
 * Contract lines as one card per property: each room (with how many it
 * sleeps and who is staying), apartment and shop, its monthly amount and, with
 * `showContract`, the contract it is rented under.
 */
export default function PropertyHoldings({ lines, currency, showContract = false }) {
    const { t, formatMoney } = useTranslation();
    const summary = useHoldingSummary();
    const properties = [];

    lines.forEach((line) => {
        const group = properties.find((item) => item.property.id === line.property.id);

        if (group) {
            group.lines.push(line);
        } else {
            properties.push({ property: line.property, lines: [line] });
        }
    });

    if (properties.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('leasing.holdings.empty')}</p>;
    }

    return (
        <div className="@container">
            <div className="grid gap-4 @3xl:grid-cols-2">
                {properties.map(({ property, lines: propertyLines }) => (
                    <section key={property.id} className="flex flex-col overflow-hidden rounded-xl ring-1 ring-foreground/[0.08]">
                        <header className="flex items-start gap-3 border-b bg-muted/40 px-4 py-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-brand-cyan to-brand-navy text-white">
                                <Building2Icon className="size-4" />
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                <Link href={route('properties.show', property.id)} dir="auto" className="truncate text-sm font-semibold hover:text-brand-ink">
                                    {property.name}
                                </Link>
                                <span className="truncate text-xs text-muted-foreground">
                                    <span className="font-mono">{property.code}</span> · {summary(holdingTotals(propertyLines))}
                                </span>
                            </div>
                            <span className="text-sm font-bold tabular-nums">
                                {formatMoney(
                                    propertyLines.reduce((sum, line) => sum + line.monthlyRate, 0),
                                    currency,
                                )}
                            </span>
                        </header>
                        <ul className="flex flex-col divide-y">
                            {propertyLines.map((line) => {
                                const Icon = UNIT_ICONS[line.unitType];
                                const label = {
                                    room: t('leasing.lines.roomName', { room: line.roomNumber }),
                                    apartment: t('leasing.lines.apartment', { number: line.apartmentNumber }),
                                    shop: t('leasing.lines.shop', { number: line.shopNumber }),
                                }[line.unitType];
                                const detail = [
                                    t(`leasing.unitTypes.${line.unitType}`),
                                    line.capacity > 0 && t('common.sleeps', { count: line.capacity }),
                                    line.housesOccupants && t('leasing.holdings.staying', { count: line.staying ?? 0 }),
                                ]
                                    .filter(Boolean)
                                    .join(' · ');

                                return (
                                    <li key={line.id} className="flex items-center gap-3 px-4 py-2.5">
                                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                            <span className="truncate text-[0.8125rem] font-medium">{label}</span>
                                            <span className="truncate text-xs text-muted-foreground">{detail}</span>
                                        </div>
                                        {showContract && line.contract && (
                                            <Badge
                                                variant={line.contract.status === 'active' ? 'info' : 'secondary'}
                                                render={<Link href={route('contracts.show', line.contract.id)} />}
                                            >
                                                {line.contract.number}
                                            </Badge>
                                        )}
                                        <span className="text-[0.8125rem] tabular-nums">{formatMoney(line.monthlyRate, currency)}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}
