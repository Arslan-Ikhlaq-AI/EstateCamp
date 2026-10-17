import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LOCALES, useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { ArrowRightIcon, CircleCheckIcon } from 'lucide-react';
import HorizontalStackChart, { ChartLegendList } from './HorizontalStackChart';

const BED_KEYS = ['occupied', 'available', 'outOfService'];
const RENT_KEYS = ['rentRoll', 'vacancy'];

const COLORS = {
    occupied: 'var(--chart-1)',
    available: 'var(--chart-2)',
    outOfService: 'var(--chart-3)',
    rentRoll: 'var(--chart-1)',
    vacancy: 'var(--chart-2)',
};

/**
 * Monthly rent if every bed in service were let, worked out the same way as
 * the server's portfolio total: occupied plus free beds in active rooms, at
 * each room's bed rate.
 */
const potentialRent = (rooms) =>
    rooms.reduce(
        (sum, room) => sum + (room.occupied + (room.status === 'active' ? room.capacity - room.occupied : 0)) * (room.rentPerBed ?? 0),
        0,
    );

function Section({ title, aside, children }) {
    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h3 className="text-sm font-medium">{title}</h3>
                {aside}
            </div>
            {children}
        </section>
    );
}

/**
 * Each property's beds by status and its rent roll against what it could
 * earn, then beds by room type, as aligned bar charts.
 */
export default function PortfolioPerformance({ properties, rooms, roomTypes, summary, currency, className }) {
    const { t, tOr, locale, formatNumber, formatPercent, formatCurrency } = useTranslation();
    const money = (value) => formatCurrency(value, currency);
    const compactMoney = (value) =>
        new Intl.NumberFormat(LOCALES[locale].intl, {
            notation: 'compact',
            maximumFractionDigits: 1,
            numberingSystem: 'latn',
        }).format(value);

    const data = properties.map((property) => {
        const potential = potentialRent(rooms.filter((room) => room.propertyCode === property.code));

        return {
            name: property.name,
            occupied: property.beds.occupied,
            available: property.beds.available,
            outOfService: property.beds.outOfService,
            occupancy: property.beds.occupancyRate,
            rentRoll: property.rentRoll,
            vacancy: Math.max(potential - property.rentRoll, 0),
            capture: potential > 0 ? (property.rentRoll / potential) * 100 : null,
        };
    });

    const roomTypeData = roomTypes.map((roomType) => ({
        name: tOr(`roomTypes.${roomType.slug}`, roomType.name),
        occupied: roomType.beds.occupied,
        available: roomType.beds.available,
        outOfService: roomType.beds.outOfService,
        occupancy: roomType.beds.occupancyRate,
    }));

    const config = Object.fromEntries(
        [...BED_KEYS, ...RENT_KEYS].map((key) => [
            key,
            {
                label: key === 'rentRoll' || key === 'vacancy' ? t(`dashboard.performance.${key}`) : t(`dashboard.beds.${key}`),
                color: COLORS[key],
            },
        ]),
    );

    const vacancyLoss = Math.max(summary.potentialRent - summary.rentRoll, 0);
    const percentOrDash = (value) => (value === null ? '—' : formatPercent(value));

    return (
        <Card className={className}>
            <CardHeader className="border-b">
                <CardTitle>{t('dashboard.performance.title')}</CardTitle>
                <CardDescription>{t('dashboard.performance.description')}</CardDescription>
                <CardAction>
                    <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={route('properties.index')} />}>
                        {t('nav.allProperties')}
                        <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />
                    </Button>
                </CardAction>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
                <Section
                    title={t('dashboard.performance.beds')}
                    aside={
                        <ChartLegendList
                            items={BED_KEYS.map((key) => ({ key, label: config[key].label, color: COLORS[key], value: formatNumber(summary.beds[key]) }))}
                        />
                    }
                >
                    <HorizontalStackChart
                        label={t('dashboard.performance.beds')}
                        data={data}
                        keys={BED_KEYS}
                        config={config}
                        formatValue={formatNumber}
                        formatTick={formatNumber}
                        endLabel={{ key: 'occupancy', format: percentOrDash }}
                    />
                </Section>

                <Separator />

                <Section
                    title={t('dashboard.performance.rent')}
                    aside={
                        <ChartLegendList
                            items={[
                                { key: 'rentRoll', label: config.rentRoll.label, color: COLORS.rentRoll, value: money(summary.rentRoll) },
                                { key: 'vacancy', label: config.vacancy.label, color: COLORS.vacancy, value: money(vacancyLoss) },
                            ]}
                        />
                    }
                >
                    <HorizontalStackChart
                        label={t('dashboard.performance.rent')}
                        data={data}
                        keys={RENT_KEYS}
                        config={config}
                        formatValue={money}
                        formatTick={compactMoney}
                        endLabel={{ key: 'capture', format: percentOrDash }}
                    />
                    {vacancyLoss > 0 ? (
                        <p className="text-xs text-muted-foreground">
                            {t('dashboard.performance.vacancyLoss', { amount: money(vacancyLoss) })}
                        </p>
                    ) : (
                        summary.potentialRent > 0 && (
                            <Badge variant="success" className="self-start">
                                <CircleCheckIcon data-icon="inline-start" />
                                {t('dashboard.performance.fullyLet')}
                            </Badge>
                        )
                    )}
                </Section>

                {roomTypeData.length > 0 && (
                    <>
                        <Separator />

                        <Section title={t('dashboard.performance.roomTypes')}>
                            <HorizontalStackChart
                                label={t('dashboard.performance.roomTypes')}
                                data={roomTypeData}
                                keys={BED_KEYS}
                                config={config}
                                formatValue={formatNumber}
                                formatTick={formatNumber}
                                endLabel={{ key: 'occupancy', format: percentOrDash }}
                            />
                        </Section>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
