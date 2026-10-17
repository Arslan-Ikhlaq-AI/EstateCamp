import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { CirclePlusIcon, XIcon } from 'lucide-react';

/**
 * A multi-select filter: a dashed button with how many values are chosen
 * (the values themselves show as chips below the toolbar), and a menu of
 * options with how many properties each would show.
 */
export default function FacetFilter({ title, options, selected, onChange }) {
    const { t, formatNumber } = useTranslation();

    const toggle = (value, isChecked) =>
        onChange(isChecked ? [...selected, value] : selected.filter((item) => item !== value));

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="outline"
                        className={cn(selected.length === 0 && 'border-dashed')}
                    />
                }
            >
                <CirclePlusIcon data-icon="inline-start" />
                {title}
                {selected.length > 0 && (
                    <>
                        <Separator
                            orientation="vertical"
                            className="mx-0.5 data-vertical:h-4 data-vertical:self-auto"
                        />
                        <Badge
                            variant="default"
                            className="min-w-5 rounded-sm px-1 tabular-nums"
                            aria-label={t('properties.filters.selected', { count: selected.length })}
                        >
                            {formatNumber(selected.length)}
                        </Badge>
                    </>
                )}
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{title}</DropdownMenuLabel>
                    {options.map((option) => (
                        <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={selected.includes(option.value)}
                            onCheckedChange={(isChecked) => toggle(option.value, isChecked)}
                        >
                            {option.icon && <option.icon className="text-muted-foreground" />}
                            <span className="truncate">{option.label}</span>
                            <DropdownMenuShortcut
                                className={cn(
                                    'tracking-normal tabular-nums',
                                    option.count === 0 && 'opacity-50',
                                )}
                            >
                                {formatNumber(option.count)}
                            </DropdownMenuShortcut>
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuGroup>

                {selected.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => onChange([])}>
                                <XIcon />
                                {t('properties.filters.clear')}
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
