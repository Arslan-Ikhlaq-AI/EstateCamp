import FlashMessages from '@/Components/FlashMessages';
import { FormActions } from '@/Components/FormShell';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, router, useForm } from '@inertiajs/react';
import { LogInIcon, LockIcon, UsersRoundIcon } from 'lucide-react';
import CompanyMark from './Partials/CompanyMark';

/**
 * One top menu's pages, each switched on or off for the company. Pages the
 * company needs to manage itself stay on.
 */
function ModulePages({ module, disabled, onToggle, onModule }) {
    const { t, formatNumber } = useTranslation();
    const switchable = module.pages.filter((page) => !page.alwaysOn);
    const on = module.pages.filter((page) => !disabled.has(page.key)).length;

    return (
        <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
                <CardTitle>{t(`permissions.modules.${module.key}`)}</CardTitle>
                <CardDescription className="tabular-nums">{t('permissions.features.moduleOn', { on: formatNumber(on), total: formatNumber(module.pages.length) })}</CardDescription>
                {switchable.length > 0 && (
                    <CardAction className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => onModule(switchable, true)}>
                            {t('permissions.features.allOn')}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => onModule(switchable, false)}>
                            {t('permissions.features.allOff')}
                        </Button>
                    </CardAction>
                )}
            </CardHeader>
            <ul className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5 lg:px-6 2xl:grid-cols-3">
                {module.pages.map((page) => {
                    const id = `feature-${page.key}`;
                    const isOn = !disabled.has(page.key);

                    return (
                        <li key={page.key}>
                            <label
                                htmlFor={id}
                                title={page.alwaysOn ? t('permissions.features.alwaysOn') : undefined}
                                className={cn(
                                    'flex h-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ring-1 ring-foreground/10 transition-colors select-none',
                                    isOn ? 'bg-primary/[0.05] ring-primary/25' : 'text-muted-foreground',
                                    page.alwaysOn ? 'cursor-default' : 'cursor-pointer hover:bg-muted/60',
                                )}
                            >
                                <Checkbox id={id} checked={isOn} disabled={page.alwaysOn} onCheckedChange={(checked) => onToggle(page.key, Boolean(checked))} />
                                <span className="min-w-0 flex-1 font-medium">{t(`permissions.pages.${page.key}`)}</span>
                                {page.alwaysOn && <LockIcon className="size-3.5 text-muted-foreground" />}
                            </label>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

/**
 * Which pages a company may use. A page switched off disappears, with its
 * menu item and everything on it, for all of the company's users.
 */
export default function CompanyFeatures({ company, modules, disabled }) {
    const { t } = useTranslation();
    const form = useForm({ disabled_features: disabled });
    const { data, setData, processing, isDirty, errors } = form;
    const off = new Set(data.disabled_features);
    const order = modules.flatMap((module) => module.pages.map((page) => page.key));

    const save = (next) => setData('disabled_features', order.filter((key) => next.has(key)));

    const toggle = (page, isOn) => {
        const next = new Set(off);

        isOn ? next.delete(page) : next.add(page);
        save(next);
    };

    const setModule = (pages, isOn) => {
        const next = new Set(off);

        pages.forEach((page) => (isOn ? next.delete(page.key) : next.add(page.key)));
        save(next);
    };

    const submit = (event) => {
        event.preventDefault();
        form.put(route('admin.companies.update', company.id), { preserveScroll: true, onSuccess: () => form.setDefaults() });
    };

    const saveButton = (
        <Button type="submit" variant="brand" disabled={processing || !isDirty}>
            {processing && <Spinner data-icon="inline-start" />}
            {t('permissions.features.save')}
        </Button>
    );

    return (
        <DashboardLayout>
            <Head title={t('permissions.features.title', { name: company.name })} />

            <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-6">
                <PageHeader
                    breadcrumbs={[{ label: t('nav.platform') }, { label: t('permissions.companies.title'), href: route('admin.companies.index') }, { label: company.name }]}
                    title={t('permissions.features.title', { name: company.name })}
                    badge={
                        <Badge variant="secondary">
                            <UsersRoundIcon data-icon="inline-start" />
                            {t('common.members', { count: company.users })}
                        </Badge>
                    }
                    description={t('permissions.features.description')}
                    actions={
                        <>
                            <Button type="button" variant="outline" onClick={() => router.post(route('admin.companies.open', company.id))}>
                                <LogInIcon data-icon="inline-start" />
                                {t('permissions.features.open')}
                            </Button>
                            {saveButton}
                        </>
                    }
                    actionsClassName="max-sm:hidden"
                />

                <FlashMessages errorKeys={['disabled_features']} />

                <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3 ring-1 ring-foreground/[0.06]">
                    <CompanyMark company={company} />
                    <div className="flex min-w-0 flex-col">
                        <span dir="auto" className="truncate font-semibold">
                            {company.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{company.email ?? company.slug}</span>
                    </div>
                </div>

                {errors['disabled_features.0'] && <p className="text-sm text-destructive">{errors['disabled_features.0']}</p>}

                <div className="flex flex-col gap-4">
                    {modules.map((module) => (
                        <ModulePages key={module.key} module={module} disabled={off} onToggle={toggle} onModule={setModule} />
                    ))}
                </div>

                <FormActions>
                    <span className="me-auto text-sm text-muted-foreground">{t(isDirty ? 'permissions.features.unsaved' : 'permissions.features.saved')}</span>
                    {saveButton}
                </FormActions>
            </form>
        </DashboardLayout>
    );
}
