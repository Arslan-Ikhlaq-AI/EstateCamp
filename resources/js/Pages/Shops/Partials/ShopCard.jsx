import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { Building2Icon, StoreIcon } from 'lucide-react';
import { AmenityIcons, ShopStatusBadge, useShopPlacement } from './ShopBits';
import { TYPE_ICONS, useShopTypeLabel } from './shopOptions';

function Stat({ label, value }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
        </div>
    );
}

/**
 * A shop as a card. Used in the grid and as the live preview on the shop
 * form, where `actions` is left out and the title is not a link.
 */
export default function ShopCard({ shop, currency, actions, className }) {
    const { t, formatCurrency, formatNumber } = useTranslation();
    const placement = useShopPlacement();
    const typeLabel = useShopTypeLabel();
    const TypeIcon = TYPE_ICONS[shop.type] ?? StoreIcon;
    const title = t('shopList.shop', { number: shop.number || '—' });

    return (
        <article
            className={cn(
                'group/shop flex flex-col overflow-hidden rounded-xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.07] transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-(--overlay-shadow) motion-reduce:hover:translate-y-0',
                className,
            )}
        >
            <div className="relative flex aspect-[3/1] items-center justify-center overflow-hidden bg-linear-to-br from-primary/15 to-chart-5/20">
                <TypeIcon className="size-9 text-primary/60" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    <ShopStatusBadge status={shop.status} />
                    {actions}
                </div>
                {shop.property && (
                    <span className="absolute inset-x-3 bottom-2.5 flex items-center gap-1.5 text-xs text-foreground/70">
                        <Building2Icon className="size-3.5 shrink-0" />
                        <span dir="auto" className="truncate">{shop.property.name}</span>
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="truncate font-heading text-base leading-snug font-semibold">
                        {shop.id ? (
                            <Link href={route('shops.show', shop.id)} className="underline-offset-4 hover:text-brand-ink hover:underline">
                                {title}
                            </Link>
                        ) : (
                            title
                        )}
                    </h3>
                    <p className="truncate text-sm text-muted-foreground">{placement(shop) || ' '}</p>
                </div>

                <dl className="grid grid-cols-3 gap-3">
                    <Stat
                        label={t('shopList.columns.rent')}
                        value={shop.monthlyRent === null ? '—' : formatCurrency(shop.monthlyRent, currency)}
                    />
                    <Stat
                        label={t('shopForm.fields.area')}
                        value={shop.areaSqm ? `${formatNumber(shop.areaSqm)} m²` : '—'}
                    />
                    <Stat label={t('shopForm.fields.type')} value={shop.type ? typeLabel(shop.type) : '—'} />
                </dl>

                <Separator className="mt-auto" />
                <AmenityIcons amenities={shop.amenities} max={6} />
            </div>
        </article>
    );
}
