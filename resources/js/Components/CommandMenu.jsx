import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { SearchIcon } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

const CommandPalette = lazy(() => import('@/Components/CommandPalette'));

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? navigator.userAgent);

/**
 * The "⌘K" hint: the platform's modifier and the K key.
 */
export function ShortcutHint({ className }) {
    return (
        <KbdGroup className={className}>
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>K</Kbd>
        </KbdGroup>
    );
}

/**
 * Search for any page, "add" action or preference. Opens from the header
 * button or with ⌘K / Ctrl+K anywhere in the app.
 */
export default function CommandMenu({ className }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const toggle = (event) => {
            if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey) {
                event.preventDefault();
                setIsOpen((open) => !open);
            }
        };

        window.addEventListener('keydown', toggle);

        return () => window.removeEventListener('keydown', toggle);
    }, []);

    return (
        <>
            <Button
                variant="outline"
                onClick={() => setIsOpen(true)}
                aria-label={t('header.search')}
                aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
                className={cn(
                    'h-8 justify-start gap-2 px-2.5 font-normal text-muted-foreground max-sm:size-8 max-sm:justify-center max-sm:border-transparent max-sm:bg-transparent max-sm:px-0 max-sm:shadow-none sm:w-56 lg:w-72',
                    className,
                )}
            >
                <SearchIcon />
                <span className="hidden flex-1 truncate text-start sm:inline">{t('header.search')}</span>
                <ShortcutHint className="hidden sm:inline-flex" />
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent
                    showCloseButton={false}
                    className="top-[min(14vh,7rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
                >
                    <DialogTitle className="sr-only">{t('command.label')}</DialogTitle>
                    <DialogDescription className="sr-only">{t('command.description')}</DialogDescription>
                    <Suspense
                        fallback={
                            <div className="flex h-13 items-center gap-2.5 px-4 text-[0.9375rem] text-muted-foreground">
                                <Spinner />
                                {t('command.placeholder')}
                            </div>
                        }
                    >
                        <CommandPalette onDone={() => setIsOpen(false)} />
                    </Suspense>
                </DialogContent>
            </Dialog>
        </>
    );
}
