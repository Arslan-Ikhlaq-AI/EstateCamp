import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, useComboboxAnchor } from '@/components/ui/combobox';
import { InputGroupAddon } from '@/components/ui/input-group';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Building2Icon } from 'lucide-react';
import { useMemo } from 'react';

// Matches what was typed against a property's name or code, ignoring case.
const matchesProperty = (option, query) => `${option.label} ${option.code ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());

/**
 * Which property a page covers: all of them, or one. The field shows the
 * choice and is typed into to search, over a list that scrolls, so it holds
 * any number of properties. `chosen` and what `onChange` gets are a
 * property's id as a string, or '' for all of them.
 */
export default function PropertyFilter({ properties, chosen, onChange }) {
    const { t } = useTranslation();
    const allProperties = t('finance.overview.property.all');
    const options = useMemo(
        () => [{ value: '', label: allProperties }, ...properties.map((property) => ({ value: String(property.id), label: property.name, code: property.code }))],
        [properties, allProperties],
    );
    // The list opens under the whole field, not under its chevron button.
    const anchor = useComboboxAnchor();

    return (
        <Combobox
            items={options}
            value={options.find((option) => option.value === chosen) ?? options[0]}
            onValueChange={(option) => option && onChange(option.value)}
            itemToStringLabel={(option) => option.label}
            isItemEqualToValue={(option, current) => option.value === current.value}
            filter={matchesProperty}
            autoHighlight
        >
            <div ref={anchor} className="w-full sm:w-auto">
                <ComboboxInput
                    placeholder={t('finance.overview.property.search')}
                    aria-label={t('finance.overview.property.label')}
                    className={cn('w-full sm:w-64', chosen && 'border-brand-cyan/40 bg-brand-cyan/[0.06]')}
                    inputClassName="font-medium"
                    onClick={(event) => event.currentTarget.select()}
                >
                    <InputGroupAddon>
                        <Building2Icon className={cn(chosen && 'text-brand-cyan')} />
                    </InputGroupAddon>
                </ComboboxInput>
            </div>
            <ComboboxContent anchor={anchor} className="w-80">
                <ComboboxEmpty>{t('finance.overview.property.empty')}</ComboboxEmpty>
                <ComboboxList>
                    {(option) => (
                        <ComboboxItem key={option.value} value={option}>
                            <span dir="auto" className="min-w-0 flex-1 truncate">
                                {option.label}
                            </span>
                            {option.code && <span className="shrink-0 text-xs text-muted-foreground">{option.code}</span>}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}
