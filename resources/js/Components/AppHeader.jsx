import CommandMenu from '@/Components/CommandMenu';
import LanguageMenu from '@/Components/LanguageMenu';
import NotificationsMenu from '@/Components/NotificationsMenu';
import QuickCreateMenu from '@/Components/QuickCreateMenu';
import ThemeMenu from '@/Components/ThemeMenu';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useTranslation } from '@/hooks/use-translation';

/**
 * The bar above every app page: the sidebar toggle, search, the Create menu
 * and the language, theme and notification menus.
 */
export default function AppHeader() {
    const { t } = useTranslation();

    return (
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/75 px-3 backdrop-blur-xl md:rounded-t-xl md:px-4 lg:px-6">
            <SidebarTrigger
                className="-ms-1 text-muted-foreground hover:text-foreground rtl:rotate-180"
                aria-label={t('header.toggleSidebar')}
            />
            <Separator
                orientation="vertical"
                className="me-1 data-vertical:h-5 data-vertical:self-auto"
            />

            <CommandMenu />

            <div className="ms-auto flex shrink-0 items-center gap-1">
                <QuickCreateMenu />
                <Separator
                    orientation="vertical"
                    className="mx-1.5 hidden data-vertical:h-5 data-vertical:self-auto sm:block"
                />
                <LanguageMenu />
                <ThemeMenu />
                <NotificationsMenu />
            </div>
        </header>
    );
}
