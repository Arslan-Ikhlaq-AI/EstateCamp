import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setAppearance, useAppearance } from '@/hooks/use-appearance';
import { useTranslation } from '@/hooks/use-translation';
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';

const OPTIONS = [
    { value: 'light', icon: SunIcon },
    { value: 'dark', icon: MoonIcon },
    { value: 'system', icon: MonitorIcon },
];

export default function ThemeMenu() {
    const { t } = useTranslation();
    const appearance = useAppearance();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('header.theme')}
                    />
                }
            >
                <SunIcon className="dark:hidden" />
                <MoonIcon className="hidden dark:block" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('header.theme')}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                        value={appearance}
                        onValueChange={setAppearance}
                    >
                        {OPTIONS.map(({ value, icon: Icon }) => (
                            <DropdownMenuRadioItem key={value} value={value}>
                                <Icon />
                                {t(`header.${value}`)}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
