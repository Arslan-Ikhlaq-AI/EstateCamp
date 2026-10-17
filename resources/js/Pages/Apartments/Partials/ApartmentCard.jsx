import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Building2Icon, HouseIcon } from 'lucide-react';
import { AmenityIcons, ApartmentStatusBadge, useApartmentLayout, useApartmentPlacement } from './ApartmentBits';
import { FURNISHING_ICONS } from './apartmentOptions';

function Stat({ label, value }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
        </div>
    );
}

/**
 * An apartment as a card. Used in the grid and as the live preview on the
 * apartment form, where `actions` is left out and the title is not a link.
 */
export default function ApartmentCard({ apartment, currency, actions, className }) {
    const { t, formatCurrency, formatNumber } = useTranslation();
    const placement = useApartmentPlacement();
    const layout = useApartmentLayout();
    const FurnishingIcon = FURNISHING_ICONS[apartment.furnishing];
    const title = t('apartmentList.apartment', { number: apartment.number || '—' });

    return (
        <article
            className={cn(
                'group/apartment flex flex-col overflow-hidden rounded-xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.07] transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-(--overlay-shadow) motion-reduce:hover:translate-y-0',
                className,
            )}
        >
            <div className="relative flex aspect-[3/1] items-center justify-center overflow-hidden bg-linear-to-br from-primary/15 to-chart-5/20">
                <HouseIcon className="size-9 text-primary/60" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    <ApartmentStatusBadge status={apartment.status} />
                    {actions}
                </div>
                {apartment.property && (
                    <span className="absolute inset-x-3 bottom-2.5 flex items-center gap-1.5 text-xs text-foreground/70">
                        <Building2Icon className="size-3.5 shrink-0" />
                        <span dir="auto" className="truncate">{apartment.property.name}</span>
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="truncate font-heading text-base leading-snug font-semibold">
                        {apartment.id ? (
                            <Link href={route('apartments.show', apartment.id)} className="hover:underline">
                                {title}
                            </Link>
                        ) : (
                            title
                        )}
                    </h3>
                    <p className="truncate text-sm text-muted-foreground">{placement(apartment) || ' '}</p>
                </div>

                <p className="text-sm text-muted-foreground tabular-nums">{layout(apartment)}</p>

                <dl className="grid grid-cols-3 gap-3">
                    <Stat
                        label={t('apartmentList.columns.rent')}
                        value={apartment.monthlyRent === null ? '—' : formatCurrency(apartment.monthlyRent, currency)}
                    />
                    <Stat
                        label={t('apartmentForm.fields.area')}
                        value={apartment.areaSqm ? `${formatNumber(apartment.areaSqm)} m²` : '—'}
                    />
                    <Stat
                        label={t('apartmentForm.fields.furnishing')}
                        value={
                            apartment.furnishing ? (
                                <span className="flex items-center gap-1">
                                    {FurnishingIcon && <FurnishingIcon className="size-3.5 shrink-0" />}
                                    <span className="truncate">{t(`furnishing.${apartment.furnishing}`)}</span>
                                </span>
                            ) : (
                                '—'
                            )
                        }
                    />
                </dl>

                <Separator className="mt-auto" />
                <AmenityIcons amenities={apartment.amenities} max={6} />
            </div>
        </article>
    );
}
