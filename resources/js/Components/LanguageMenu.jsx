import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALES, setLocale, useTranslation } from '@/hooks/use-translation';
import { LanguagesIcon } from 'lucide-react';

export default function LanguageMenu() {
    const { t, locale } = useTranslation();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        className="gap-1.5 px-2.5"
                        aria-label={t('header.language')}
                    />
                }
            >
                <LanguagesIcon data-icon="inline-start" />
                <span className="text-xs font-semibold uppercase">{locale}</span>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>{t('header.language')}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={locale} onValueChange={setLocale}>
                        {Object.entries(LOCALES).map(([code, { name, dir }]) => (
                            <DropdownMenuRadioItem key={code} value={code}>
                                <span lang={code} dir={dir}>
                                    {name}
                                </span>
                                <DropdownMenuShortcut className="uppercase">
                                    {code}
                                </DropdownMenuShortcut>
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
