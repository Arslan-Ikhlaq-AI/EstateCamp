import { Checkbox } from '@/components/ui/checkbox';
import { FieldError } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Building2Icon } from 'lucide-react';

/**
 * The camps an area manager or camp boss looks after: any number of the
 * company's properties, or one for a camp boss.
 */
export default function CampPicker({ properties, value, limit, disabled, error, onChange }) {
    const { t, formatNumber } = useTranslation();
    const chosen = new Set(value);

    if (properties.length === 0) {
        return <p className="text-sm text-muted-foreground">{t('permissions.user.noProperties')}</p>;
    }

    const toggle = (id, checked) => {
        if (limit === 1) {
            onChange(checked ? [id] : []);

            return;
        }

        onChange(properties.map((property) => property.id).filter((propertyId) => (propertyId === id ? checked : chosen.has(propertyId))));
    };

    return (
        <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">{t('permissions.user.campsSelected', { count: formatNumber(chosen.size), total: formatNumber(properties.length) })}</span>
            <ul role={limit === 1 ? 'radiogroup' : undefined} aria-label={t('permissions.user.campsSection')} className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                {properties.map((property) => {
                    const id = `camp-${property.id}`;
                    const isChosen = chosen.has(property.id);

                    return (
                        <li key={property.id}>
                            <label
                                htmlFor={id}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm ring-1 ring-foreground/10 transition-colors select-none',
                                    isChosen && 'bg-brand-cyan/[0.07] ring-brand-cyan/50',
                                    disabled ? 'cursor-default' : 'cursor-pointer hover:bg-muted/60',
                                )}
                            >
                                <Checkbox id={id} checked={isChosen} disabled={disabled} onCheckedChange={(checked) => toggle(property.id, Boolean(checked))} />
                                <Building2Icon className="size-4 shrink-0 text-muted-foreground" />
                                <span dir="auto" className="min-w-0 flex-1 truncate font-medium">
                                    {property.name}
                                </span>
                                {property.code && <span className="text-xs text-muted-foreground tabular-nums">{property.code}</span>}
                            </label>
                        </li>
                    );
                })}
            </ul>
            <FieldError>{error}</FieldError>
        </div>
    );
}
