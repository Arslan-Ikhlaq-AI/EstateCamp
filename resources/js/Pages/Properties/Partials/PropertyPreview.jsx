import PropertyCover from '@/Components/PropertyCover';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { CalendarRangeIcon, ConciergeBellIcon, DoorOpenIcon, FileTextIcon, HouseIcon, LandmarkIcon, LayersIcon, MapPinIcon, StoreIcon } from 'lucide-react';
import { FACILITIES } from './BuildingFacilities';
import { hasFile } from './RequiredDocuments';
import { unitNumbers } from './UnitBatches';

const STATUS_DOTS = { active: 'bg-success', inactive: 'bg-muted-foreground', under_maintenance: 'bg-warning' };

function Row({ icon: Icon, children }) {
    return (
        <li className="flex items-start gap-2.5 text-[0.8125rem]">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">{children}</span>
        </li>
    );
}

/**
 * The property as it will appear, updating as the form is filled in: its
 * photo, type, name, code and place, its status, the units about to be
 * added, its floors and units, its facilities, the landlord and lease, and
 * its documents.
 */
export default function PropertyPreview({ data, coverUrl, propertyTypes, landlords, savedUnits = 0 }) {
    const { t, tOr, formatNumber, formatDate } = useTranslation();
    const type = propertyTypes.find((item) => String(item.id) === String(data.property_type_id));
    const place = [data.area, data.city, data.country_code].filter(Boolean).join(', ');
    const count = (kind) => data.units[kind].reduce((sum, batch) => sum + unitNumbers(batch.first_number, batch.count).length, 0);
    const beds = data.units.rooms.reduce((sum, batch) => sum + unitNumbers(batch.first_number, batch.count).length * (Number(batch.capacity) || 0), 0);
    const units = [
        { key: 'rooms', icon: DoorOpenIcon, count: count('rooms') },
        { key: 'shops', icon: StoreIcon, count: count('shops') },
        { key: 'apartments', icon: HouseIcon, count: count('apartments') },
    ].filter((unit) => unit.count > 0);
    const landlord =
        data.landlord_mode === 'new' ? data.new_landlord.name : landlords.find((item) => String(item.id) === String(data.landlord_id))?.name;
    const isLeased = data.ownership_type === 'leased';
    const documentCount = data.documents.filter(hasFile).length;
    const size = [
        Number(data.total_floors) > 0 && t('propertyForm.size.floorsCount', { count: Number(data.total_floors) }),
        Number(data.total_units) > 0 &&
            t('propertyForm.size.planned', { used: formatNumber(savedUnits + units.reduce((sum, unit) => sum + unit.count, 0)), total: formatNumber(Number(data.total_units)) }),
    ].filter(Boolean);
    const facilities = FACILITIES.filter((facility) => Number(data[facility.key]) > 0).map((facility) =>
        t(`propertyForm.facilities.counts.${facility.key}`, { count: Number(data[facility.key]) }),
    );

    return (
        <Card className="gap-4 overflow-hidden pt-0">
            <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                <PropertyCover key={coverUrl ?? 'none'} src={coverUrl} />
                <div className="absolute inset-0 bg-linear-to-t from-brand-navy/85 via-brand-navy/15 to-transparent" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    {type ? (
                        <Badge className="border-white/25 bg-black/35 text-white backdrop-blur-md">{tOr(`propertyTypes.${type.slug}`, type.name)}</Badge>
                    ) : (
                        <span />
                    )}
                    <Badge className={cn('border-white/25', isLeased ? 'bg-gold text-brand-navy' : 'bg-white/90 text-brand-navy')}>
                        {t(`properties.ownership.${isLeased ? 'leased' : 'owned'}`)}
                    </Badge>
                </div>
                <div className="absolute inset-x-4 bottom-3 flex flex-col gap-0.5 text-white">
                    <span dir="auto" className={cn('truncate font-heading text-lg font-bold', !data.name && 'text-white/60')}>
                        {data.name || t('propertyForm.preview.name')}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-white/80">
                        {data.code && <span className="rounded bg-white/15 px-1.5 py-0.5 font-mono tracking-tight">{data.code}</span>}
                        <span className="flex items-center gap-1.5">
                            <span aria-hidden="true" className={cn('size-2 rounded-full ring-2 ring-white/30', STATUS_DOTS[data.status])} />
                            {t(`status.${data.status}`)}
                        </span>
                    </span>
                </div>
            </div>

            <CardHeader>
                <CardTitle className="text-sm">{t('propertyForm.preview.title')}</CardTitle>
                <CardDescription className="text-xs">{t('propertyForm.preview.description')}</CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
                <ul className="flex flex-col gap-2.5">
                    <Row icon={MapPinIcon}>
                        <span dir="auto" className={cn(!place && 'text-muted-foreground')}>{place || t('propertyForm.preview.noLocation')}</span>
                    </Row>
                    {isLeased && (
                        <Row icon={LandmarkIcon}>
                            <span className="text-muted-foreground">{t('propertyForm.preview.landlord')}: </span>
                            <span dir="auto" className="font-medium">{landlord || '—'}</span>
                        </Row>
                    )}
                    {isLeased && data.lease_start_date && data.lease_end_date && (
                        <Row icon={CalendarRangeIcon}>
                            {formatDate(data.lease_start_date)} – {formatDate(data.lease_end_date)}
                        </Row>
                    )}
                    {size.length > 0 && <Row icon={LayersIcon}>{size.join(' · ')}</Row>}
                    {facilities.length > 0 && <Row icon={ConciergeBellIcon}>{facilities.join(' · ')}</Row>}
                    {documentCount > 0 && <Row icon={FileTextIcon}>{t('propertyForm.preview.documents', { count: documentCount })}</Row>}
                </ul>

                <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
                    <span className="text-xs font-semibold text-muted-foreground">{t('propertyForm.preview.toAdd')}</span>
                    {units.length === 0 ? (
                        <span className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.preview.nothingToAdd')}</span>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {units.map((unit) => (
                                <Badge key={unit.key} variant="info" className="h-6 gap-1.5">
                                    <unit.icon data-icon="inline-start" />
                                    {formatNumber(unit.count)} {t(`propertyForm.units.kinds.${unit.key}`)}
                                </Badge>
                            ))}
                            {beds > 0 && (
                                <Badge className="h-6 bg-gold/20 text-gold-ink inset-ring inset-ring-gold/30">{t('common.beds', { count: beds })}</Badge>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
