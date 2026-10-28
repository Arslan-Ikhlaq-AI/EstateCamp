import { TextField } from '@/Components/FormFields';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { ConciergeBellIcon, CookingPotIcon, ShowerHeadIcon, StethoscopeIcon, UserCogIcon } from 'lucide-react';
import { TONES } from './FormSteps';

/**
 * The shared rooms a property is counted with. They are numbers only; no
 * rooms are created for them.
 */
export const FACILITIES = [
    { key: 'medical_rooms', icon: StethoscopeIcon, tone: 'green' },
    { key: 'kitchens', icon: CookingPotIcon, tone: 'gold' },
    { key: 'washrooms', icon: ShowerHeadIcon, tone: 'brand' },
    { key: 'supervisor_rooms', icon: UserCogIcon, tone: 'navy' },
];

function FacilityIcon({ facility, className, iconClassName = 'size-3.5' }) {
    return (
        <span className={cn('flex shrink-0 items-center justify-center rounded-md', TONES[facility.tone].tile, className)}>
            <facility.icon className={iconClassName} />
        </span>
    );
}

/**
 * How many medical rooms, kitchens, washrooms and supervisor rooms the
 * property has.
 */
export default function BuildingFacilities({ data, onChange, errors }) {
    const { t } = useTranslation();

    return (
        <section className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/[0.06]">
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-ink shadow-sm ring-1 ring-foreground/[0.06]">
                    <ConciergeBellIcon className="size-4.5" />
                </span>
                <div className="flex flex-col gap-0.5">
                    <h3 className="text-sm font-bold">{t('propertyForm.facilities.title')}</h3>
                    <p className="text-[0.8125rem] text-muted-foreground">{t('propertyForm.facilities.description')}</p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FACILITIES.map((facility) => (
                    <TextField
                        key={facility.key}
                        id={facility.key}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={1000}
                        placeholder="0"
                        label={
                            <>
                                <FacilityIcon facility={facility} className="size-6" />
                                {t(`propertyForm.facilities.${facility.key}`)}
                            </>
                        }
                        value={data[facility.key]}
                        onChange={(value) => onChange(facility.key, value)}
                        error={errors[facility.key]}
                        inputClassName="bg-surface"
                    />
                ))}
            </div>
        </section>
    );
}

/**
 * The property's facility counts as tiles, a dash for any not entered.
 * `facilities` maps each facility key to its count.
 */
export function FacilityCounts({ facilities }) {
    const { t, formatNumber } = useTranslation();

    return (
        <dl className="grid grid-cols-2 gap-3">
            {FACILITIES.map((facility) => (
                <div key={facility.key} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 ring-1 ring-foreground/[0.06]">
                    <FacilityIcon facility={facility} className="size-9 rounded-lg" iconClassName="size-4.5" />
                    <div className="flex min-w-0 flex-col-reverse">
                        <dt className="truncate text-xs text-muted-foreground">{t(`propertyForm.facilities.${facility.key}`)}</dt>
                        <dd className="font-heading text-lg leading-tight font-bold tabular-nums">
                            {facilities[facility.key] === null ? '—' : formatNumber(facilities[facility.key])}
                        </dd>
                    </div>
                </div>
            ))}
        </dl>
    );
}
