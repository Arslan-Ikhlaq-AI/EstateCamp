import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { BedDoubleIcon, Building2Icon, DoorOpenIcon, HouseIcon, StoreIcon } from 'lucide-react';

export const UNIT_ICONS = { bed: BedDoubleIcon, room: DoorOpenIcon, apartment: HouseIcon, shop: StoreIcon };

/**
 * What one line rents, in words: the unit (room, apartment or shop number,
 * or "beds anywhere"), how many beds it covers and the property it is in.
 */
export function useDescribeLine(properties) {
    const { t } = useTranslation();

    return (line) => {
        const property = properties.find((item) => item.id === line.property_id);
        const room = property?.rooms.find((item) => item.id === line.room_id);
        const beds = line.unit_type === 'room' ? (room?.capacity ?? 0) : line.unit_type === 'bed' ? Number(line.quantity) || 0 : 0;

        const label = {
            bed: room ? t('leasing.lines.roomName', { room: room.number }) : t('leasing.contracts.form.picker.anywhereShort'),
            room: room ? t('leasing.lines.roomName', { room: room.number }) : '',
            apartment: t('leasing.lines.apartment', { number: property?.apartments.find((item) => item.id === line.apartment_id)?.number }),
            shop: t('leasing.lines.shop', { number: property?.shops.find((item) => item.id === line.shop_id)?.number }),
        }[line.unit_type];

        const detail = {
            bed: t('common.beds', { count: beds }),
            room: `${t('leasing.unitTypes.room')} · ${t('common.beds', { count: beds })}`,
            apartment: t('leasing.unitTypes.apartment'),
            shop: t('leasing.unitTypes.shop'),
        }[line.unit_type];

        return { property, room, beds, label, detail };
    };
}

/**
 * The lines grouped by property, in the order their properties first appear.
 *
 * @return {Array<{ propertyId: number, indexes: number[] }>}
 */
export function groupByProperty(lines) {
    const groups = [];

    lines.forEach((line, index) => {
        const group = groups.find((item) => item.propertyId === line.property_id);

        if (group) {
            group.indexes.push(index);
        } else {
            groups.push({ propertyId: line.property_id, indexes: [index] });
        }
    });

    return groups;
}

/**
 * Everything the contract rents to the client, property by property, with
 * each unit's monthly amount and the totals underneath. Follows the form as
 * it is edited.
 */
export default function RentedSummary({ lines, properties, clientName, currency }) {
    const { t, formatMoney } = useTranslation();
    const describe = useDescribeLine(properties);
    const described = lines.map((line) => ({ line, ...describe(line) }));
    const count = (type) => lines.filter((line) => line.unit_type === type).length;
    const totals = [
        count('room') > 0 && t('propertyShow.clients.rooms', { count: count('room') }),
        t('common.beds', { count: described.reduce((sum, item) => sum + item.beds, 0) }),
        count('apartment') > 0 && t('propertyShow.clients.apartments', { count: count('apartment') }),
        count('shop') > 0 && t('propertyShow.clients.shops', { count: count('shop') }),
    ].filter(Boolean);

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{clientName ? t('leasing.contracts.form.rented.titleFor', { client: clientName }) : t('leasing.contracts.form.rented.title')}</CardTitle>
                <CardDescription>{t('leasing.contracts.form.rented.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {lines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('leasing.contracts.form.picker.nothingYet')}</p>
                ) : (
                    <>
                        {groupByProperty(lines).map((group) => {
                            const property = properties.find((item) => item.id === group.propertyId);

                            return (
                                <section key={group.propertyId} className="flex flex-col gap-2">
                                    <h3 className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                                        <Building2Icon className="size-4 text-brand-ink" />
                                        <span dir="auto" className="truncate">{property?.name}</span>
                                        <span className="font-mono text-[0.6875rem] font-normal text-muted-foreground">{property?.code}</span>
                                    </h3>
                                    <ul className="flex flex-col gap-1.5 border-s ps-3 ms-2">
                                        {group.indexes.map((index) => {
                                            const item = described[index];
                                            const Icon = UNIT_ICONS[item.line.unit_type];

                                            return (
                                                <li key={index} className="flex items-center gap-2 text-[0.8125rem]">
                                                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                                                    <span className="min-w-0 flex-1 truncate">
                                                        <span className="font-medium">{item.label}</span>
                                                        <span className="text-muted-foreground"> · {item.detail}</span>
                                                    </span>
                                                    <span className="tabular-nums">
                                                        {formatMoney((Number(item.line.monthly_rate) || 0) * (Number(item.line.quantity) || 0), currency)}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            );
                        })}
                        <p className="border-t pt-3 text-xs font-medium text-muted-foreground">
                            {t('leasing.contracts.form.rented.totals', { count: lines.length })}: {totals.join(' · ')}
                        </p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
