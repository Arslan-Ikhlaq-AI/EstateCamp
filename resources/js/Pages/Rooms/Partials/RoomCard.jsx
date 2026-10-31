import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Building2Icon, DoorOpenIcon } from 'lucide-react';
import { useState } from 'react';
import { AmenityIcons, AvailabilityBadge, RoomStatusBadge, useRoomPlacement } from './RoomBits';
import { GENDER_ICONS } from './roomOptions';

function RoomPhoto({ src }) {
    const [hasFailed, setHasFailed] = useState(false);

    if (!src || hasFailed) {
        return (
            <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/15 to-chart-5/20">
                <DoorOpenIcon className="size-8 text-primary/60" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => setHasFailed(true)}
            className="size-full object-cover transition-transform duration-500 group-hover/room:scale-105"
        />
    );
}

function Stat({ label, value }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm font-semibold tabular-nums">{value}</dd>
        </div>
    );
}

/**
 * A room as a picture card. Used in the grid and as the live preview on the
 * room form, where `actions` is left out.
 */
export default function RoomCard({ room, currency, actions, className }) {
    const { t, tOr, formatCurrency, formatNumber } = useTranslation();
    const placement = useRoomPlacement();
    const GenderIcon = GENDER_ICONS[room.genderPolicy];

    return (
        <article
            className={cn(
                'group/room flex flex-col overflow-hidden rounded-xl bg-card shadow-(--card-shadow) ring-1 ring-foreground/[0.07] transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-(--overlay-shadow) motion-reduce:hover:translate-y-0',
                className,
            )}
        >
            <div className="relative aspect-[2/1] overflow-hidden bg-muted">
                <RoomPhoto key={room.photoUrl} src={room.photoUrl} />
                <div className="absolute inset-0 bg-linear-to-t from-black/50 via-black/0 to-black/25" />
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    {room.typeSlug ? (
                        <Badge variant="outline" className="border-white/30 bg-black/40 text-white backdrop-blur">
                            {tOr(`roomTypes.${room.typeSlug}`, room.type)}
                        </Badge>
                    ) : (
                        <span />
                    )}
                    {actions}
                </div>
                {room.property && (
                    <span className="absolute inset-x-3 bottom-2.5 flex items-center gap-1.5 text-xs text-white/90">
                        <Building2Icon className="size-3.5 shrink-0" />
                        <span dir="auto" className="truncate">{room.property.name}</span>
                    </span>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h3 className="truncate font-heading text-base leading-snug font-semibold">
                            {t('roomList.room', { number: room.number || '—' })}
                        </h3>
                        <p className="truncate text-sm text-muted-foreground">{placement(room) || ' '}</p>
                    </div>
                    <RoomStatusBadge status={room.status} />
                </div>

                <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground tabular-nums">{t('common.sleeps', { count: room.capacity })}</span>
                    <AvailabilityBadge room={room} />
                </div>

                <dl className="grid grid-cols-3 gap-3">
                    <Stat
                        label={t('roomList.columns.rent')}
                        value={room.monthlyRent === null ? '—' : formatCurrency(room.monthlyRent, currency)}
                    />
                    <Stat label={t('roomForm.fields.area')} value={room.areaSqm ? `${formatNumber(room.areaSqm)} m²` : '—'} />
                    <Stat
                        label={t('roomForm.fields.gender')}
                        value={
                            room.genderPolicy ? (
                                <span className="flex items-center gap-1">
                                    {GenderIcon && <GenderIcon className="size-3.5" />}
                                    {t(`gender.${room.genderPolicy}`)}
                                </span>
                            ) : (
                                t('roomForm.fields.anyGender')
                            )
                        }
                    />
                </dl>

                <Separator className="mt-auto" />
                <AmenityIcons amenities={room.amenities} max={6} />
            </div>
        </article>
    );
}
