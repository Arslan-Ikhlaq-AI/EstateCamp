import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { setAppearance } from '@/hooks/use-appearance';
import { LOCALES, setLocale, useTranslation } from '@/hooks/use-translation';
import { createActions, pageLinks, useCanOpen } from '@/lib/navigation';
import { Autocomplete } from '@base-ui/react/autocomplete';
import { router, usePage } from '@inertiajs/react';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    CornerDownLeftIcon,
    LanguagesIcon,
    MonitorIcon,
    MoonIcon,
    SearchIcon,
    SunIcon,
} from 'lucide-react';
import { useId, useMemo } from 'react';

const THEMES = [
    { value: 'light', icon: SunIcon },
    { value: 'dark', icon: MoonIcon },
    { value: 'system', icon: MonitorIcon },
];

/**
 * The command menu's entries, grouped: every page the user can open, the
 * "add" shortcuts they may use (with a company), and theme and language switches. Each
 * entry is matched on its label, its section and its route name.
 */
function useCommandGroups() {
    const { t } = useTranslation();
    const { auth } = usePage().props;
    const canOpenLink = useCanOpen();

    return useMemo(() => {
        const entry = (item) => ({ ...item, search: `${item.label} ${item.hint ?? ''} ${item.routeName ?? ''}`.toLowerCase() });

        const pages = pageLinks(canOpenLink).map((link) =>
            entry({
                id: `page:${link.routeName}`,
                label: t(link.title),
                hint: link.section ? t(link.section) : undefined,
                icon: link.icon,
                routeName: link.routeName,
            }),
        );

        const creates = auth.company
            ? createActions.filter(canOpenLink).map((action) =>
                  entry({
                      id: `create:${action.routeName}`,
                      label: t(action.title),
                      hint: t(action.group),
                      icon: action.icon,
                      routeName: action.routeName,
                  }),
              )
            : [];

        const preferences = [
            ...THEMES.map((theme) =>
                entry({
                    id: `theme:${theme.value}`,
                    label: t('command.theme', { theme: t(`header.${theme.value}`) }),
                    hint: t('header.theme'),
                    icon: theme.icon,
                    run: () => setAppearance(theme.value),
                }),
            ),
            ...Object.entries(LOCALES).map(([code, { name }]) =>
                entry({
                    id: `locale:${code}`,
                    label: t('command.language', { name }),
                    hint: t('header.language'),
                    icon: LanguagesIcon,
                    run: () => setLocale(code),
                }),
            ),
        ];

        return [
            { value: t('command.groups.pages'), items: pages },
            { value: t('command.groups.create'), items: creates },
            { value: t('command.groups.preferences'), items: preferences },
        ].filter((group) => group.items.length > 0);
        // canOpenLink follows auth.access and the admin flag.
    }, [t, auth.user.is_admin, auth.company, auth.access]);
}

const matches = (item, query) => query.trim().toLowerCase().split(/\s+/).every((word) => item.search.includes(word));

/**
 * The searchable list inside the command menu. Loaded on first open, so the
 * autocomplete code stays out of every page's initial download.
 */
export default function CommandPalette({ onDone }) {
    const { t } = useTranslation();
    const groups = useCommandGroups();
    const hintId = useId();

    const runItem = (item) => {
        onDone();

        if (item.run) {
            item.run();

            return;
        }

        router.visit(route(item.routeName));
    };

    return (
        <Autocomplete.Root
            open
            inline
            items={groups}
            filter={matches}
            itemToStringValue={(item) => item.label}
            autoHighlight="always"
            keepHighlight
        >
            <div className="flex items-center gap-2.5 border-b px-4">
                <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <Autocomplete.Input
                    autoFocus
                    aria-label={t('command.label')}
                    aria-describedby={hintId}
                    placeholder={t('command.placeholder')}
                    className="h-13 w-full border-0 bg-transparent px-0 text-base shadow-none outline-none placeholder:text-muted-foreground focus:ring-0 focus:outline-none"
                />
                <Kbd className="hidden sm:inline-flex">Esc</Kbd>
            </div>

            <div className="max-h-[min(60dvh,26rem)] overflow-y-auto overscroll-contain p-2 [scroll-padding-block:0.5rem]">
                <Autocomplete.Empty>
                    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
                        <SearchIcon className="mb-1 size-5 text-muted-foreground" />
                        <p className="text-sm font-medium">{t('command.empty')}</p>
                        <p className="text-xs text-muted-foreground">{t('command.emptyHint')}</p>
                    </div>
                </Autocomplete.Empty>

                <Autocomplete.List>
                    {(group) => (
                        <Autocomplete.Group key={group.value} items={group.items} className="not-last:mb-2">
                            <Autocomplete.GroupLabel className="px-2.5 pt-1.5 pb-1 text-[0.75rem] font-medium text-muted-foreground ltr:tracking-[0.06em] ltr:uppercase">
                                {group.value}
                            </Autocomplete.GroupLabel>
                            <Autocomplete.Collection>
                                {(item) => (
                                    <Autocomplete.Item
                                        key={item.id}
                                        value={item}
                                        onClick={() => runItem(item)}
                                        className="group/item flex min-h-10 cursor-default items-center gap-3 rounded-lg px-2.5 text-sm outline-none select-none [scroll-margin-block:0.5rem] data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                                    >
                                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-data-highlighted/item:bg-surface group-data-highlighted/item:text-brand-ink group-data-highlighted/item:shadow-(--raised-shadow)">
                                            <item.icon className="size-4" />
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                        {item.hint && (
                                            <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span>
                                        )}
                                        <CornerDownLeftIcon
                                            aria-hidden="true"
                                            className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-data-highlighted/item:opacity-100 rtl:-scale-x-100"
                                        />
                                    </Autocomplete.Item>
                                )}
                            </Autocomplete.Collection>
                        </Autocomplete.Group>
                    )}
                </Autocomplete.List>
            </div>

            <div id={hintId} className="flex items-center gap-4 border-t bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <KbdGroup>
                        <Kbd><ArrowUpIcon /></Kbd>
                        <Kbd><ArrowDownIcon /></Kbd>
                    </KbdGroup>
                    {t('command.hints.navigate')}
                </span>
                <span className="flex items-center gap-1.5">
                    <Kbd><CornerDownLeftIcon className="rtl:-scale-x-100" /></Kbd>
                    {t('command.hints.open')}
                </span>
                <span className="ms-auto hidden items-center gap-1.5 sm:flex">
                    <Kbd>Esc</Kbd>
                    {t('command.hints.close')}
                </span>
            </div>
        </Autocomplete.Root>
    );
}
