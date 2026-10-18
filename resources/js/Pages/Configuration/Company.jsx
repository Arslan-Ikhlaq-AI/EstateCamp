import FlashMessages from '@/Components/FlashMessages';
import { SelectField, TextareaField, TextField } from '@/Components/FormFields';
import { FormActions } from '@/Components/FormShell';
import PageHeader from '@/Components/PageHeader';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/hooks/use-translation';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Head, useForm } from '@inertiajs/react';
import {
    BedDoubleIcon,
    Building2Icon,
    CalendarClockIcon,
    FileBadgeIcon,
    FileSignatureIcon,
    GlobeIcon,
    ImageUpIcon,
    MailIcon,
    MapPinIcon,
    PhoneIcon,
    ShieldCheckIcon,
    Trash2Icon,
    UserRoundIcon,
    UsersIcon,
    WalletIcon,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';

const FIELDS = [
    'name', 'legal_name', 'short_name', 'description', 'website', 'trade_license_number', 'tax_registration_number', 'email', 'phone',
    'contact_person_name', 'contact_person_phone', 'contact_person_email', 'address_line_1', 'address_line_2', 'city', 'state',
    'postal_code', 'country_code', 'default_currency', 'timezone',
];

const STATUS_VARIANTS = { active: 'success', inactive: 'secondary', suspended: 'destructive' };

/**
 * One part of the profile form: an accent icon, a title and description,
 * then its fields.
 */
function Section({ icon: Icon, tone, title, description, children }) {
    return (
        <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center gap-4 border-b bg-linear-to-r from-brand-cyan/[0.06] to-transparent px-5 py-4 rtl:bg-linear-to-l lg:px-6">
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-sm', tone)}>
                    <Icon className="size-4.5" />
                </span>
                <div className="flex flex-col gap-0.5">
                    <h2 className="font-heading text-base font-bold tracking-tight">{title}</h2>
                    <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
                </div>
            </div>
            <CardContent className="py-5 lg:py-6">{children}</CardContent>
        </Card>
    );
}

/**
 * The logo: a preview (or the initials), with upload, replace and remove.
 */
function LogoPicker({ name, previewUrl, onChoose, onRemove, error }) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-4">
                <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br from-brand-cyan to-brand-navy text-2xl font-bold text-white shadow-md ring-1 ring-foreground/10">
                    {previewUrl ? <img src={previewUrl} alt="" className="size-full bg-white object-contain p-1.5" /> : getInitials(name || '?')}
                </span>
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" render={<label htmlFor="company-logo" />} nativeButton={false}>
                            <ImageUpIcon data-icon="inline-start" />
                            {t(previewUrl ? 'configuration.company.logo.replace' : 'configuration.company.logo.upload')}
                        </Button>
                        {previewUrl && (
                            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={onRemove}>
                                <Trash2Icon data-icon="inline-start" />
                                {t('configuration.company.logo.remove')}
                            </Button>
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground">{t('configuration.company.logo.hint')}</span>
                </div>
                <input
                    id="company-logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    onChange={(event) => onChoose(event.target.files[0] ?? null)}
                />
            </div>
            <FieldError>{error}</FieldError>
        </div>
    );
}

/**
 * The company as it appears across the app: its logo, names and how to
 * reach it, following the form as it is edited.
 */
function BrandPreview({ data, logoUrl }) {
    const { t } = useTranslation();
    const place = [data.city, data.state, data.country_code].filter(Boolean).join(', ');

    return (
        <div className="relative overflow-hidden rounded-2xl bg-primary bg-(image:--sidebar-image) p-5 text-white shadow-(--overlay-shadow) ring-1 ring-white/10">
            <span aria-hidden="true" className="pointer-events-none absolute -end-12 -top-16 size-48 rounded-full bg-gold/20 blur-3xl" />
            <div className="relative flex flex-col gap-4">
                <span className="text-[0.6875rem] font-semibold tracking-wider text-white/60 uppercase">{t('configuration.company.preview')}</span>
                <div className="flex items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-lg font-bold ring-1 ring-white/15">
                        {logoUrl ? <img src={logoUrl} alt="" className="size-full bg-white object-contain p-1" /> : getInitials(data.name || '?')}
                    </span>
                    <div className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate font-heading text-base font-bold">{data.name || t('configuration.company.fields.name')}</span>
                        {(data.legal_name || data.short_name) && <span className="truncate text-xs text-white/70">{data.legal_name || data.short_name}</span>}
                    </div>
                </div>
                <ul className="flex flex-col gap-2 text-[0.8125rem] text-white/85">
                    {data.email && (
                        <li className="flex items-center gap-2">
                            <MailIcon className="size-3.5 text-brand-cyan" />
                            <span className="truncate">{data.email}</span>
                        </li>
                    )}
                    {data.phone && (
                        <li className="flex items-center gap-2">
                            <PhoneIcon className="size-3.5 text-brand-cyan" />
                            <span dir="ltr">{data.phone}</span>
                        </li>
                    )}
                    {data.website && (
                        <li className="flex items-center gap-2">
                            <GlobeIcon className="size-3.5 text-brand-cyan" />
                            <span className="truncate">{data.website.replace(/^https?:\/\//, '')}</span>
                        </li>
                    )}
                    {place && (
                        <li className="flex items-center gap-2">
                            <MapPinIcon className="size-3.5 text-brand-cyan" />
                            <span className="truncate">{place}</span>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}

/**
 * The company profile: identity and logo, registration, contacts, address,
 * and currency and time zone; beside it, a preview, the account and the
 * company's figures.
 */
export default function Company({ company, figures, currencies, timezones }) {
    const { t, formatNumber, formatDate } = useTranslation();
    const form = useForm({
        ...Object.fromEntries(FIELDS.map((field) => [field, company[field] ?? ''])),
        logo: null,
        remove_logo: false,
    });
    const { data, setData, errors, processing } = form;

    const logoUrl = useMemo(() => (data.logo ? URL.createObjectURL(data.logo) : data.remove_logo ? null : company.logo_url), [data.logo, data.remove_logo, company.logo_url]);

    useEffect(() => () => data.logo && URL.revokeObjectURL(logoUrl), [logoUrl, data.logo]);

    const bind = (field) => ({ id: field, value: data[field], onChange: (value) => setData(field, value), error: errors[field] });

    const submit = (event) => {
        event.preventDefault();
        form.transform((values) => ({ ...values, _method: 'put' }));
        form.post(route('configuration.company.update'), { forceFormData: true, preserveScroll: true });
    };

    const tiles = [
        { icon: Building2Icon, label: t('configuration.company.figures.properties'), value: figures.properties },
        { icon: BedDoubleIcon, label: t('configuration.company.figures.rooms'), value: figures.rooms },
        { icon: UsersIcon, label: t('configuration.company.figures.clients'), value: figures.clients },
        { icon: FileSignatureIcon, label: t('configuration.company.figures.contracts'), value: figures.contracts },
        { icon: UserRoundIcon, label: t('configuration.company.figures.users'), value: figures.users },
    ];

    const actions = (
        <Button type="submit" variant="brand" disabled={processing}>
            {processing && <Spinner data-icon="inline-start" />}
            {t('configuration.company.save')}
        </Button>
    );

    return (
        <DashboardLayout>
            <Head title={t('configuration.company.title')} />

            <form onSubmit={submit} className="flex flex-1 flex-col gap-6" noValidate>
                <PageHeader
                    breadcrumbs={[{ label: t('nav.configuration') }, { label: t('configuration.company.title') }]}
                    title={t('configuration.company.title')}
                    description={t('configuration.company.description')}
                    actions={actions}
                    actionsClassName="max-sm:hidden"
                />

                <FlashMessages />

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
                    <div className="flex min-w-0 flex-col gap-6">
                        <Section
                            icon={Building2Icon}
                            tone="from-brand-cyan to-brand-navy text-white"
                            title={t('configuration.company.sections.identity')}
                            description={t('configuration.company.sections.identityDescription')}
                        >
                            <FieldGroup className="gap-5">
                                <LogoPicker
                                    name={data.name}
                                    previewUrl={logoUrl}
                                    onChoose={(file) => setData((current) => ({ ...current, logo: file, remove_logo: false }))}
                                    onRemove={() => setData((current) => ({ ...current, logo: null, remove_logo: true }))}
                                    error={errors.logo}
                                />
                                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                                    <TextField {...bind('name')} label={t('configuration.company.fields.name')} inputClassName="h-11 text-base font-medium" />
                                    <TextField {...bind('short_name')} label={t('configuration.company.fields.shortName')} inputClassName="h-11" optional />
                                </div>
                                <TextField {...bind('legal_name')} label={t('configuration.company.fields.legalName')} optional />
                                <TextareaField {...bind('description')} label={t('configuration.company.fields.description')} rows={3} optional />
                            </FieldGroup>
                        </Section>

                        <Section
                            icon={FileBadgeIcon}
                            tone="from-brand-sun to-gold text-brand-navy"
                            title={t('configuration.company.sections.registration')}
                            description={t('configuration.company.sections.registrationDescription')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <TextField {...bind('trade_license_number')} label={t('configuration.company.fields.tradeLicense')} optional />
                                <TextField
                                    {...bind('tax_registration_number')}
                                    label={t('configuration.company.fields.trn')}
                                    inputMode="numeric"
                                    maxLength={15}
                                    description={t('configuration.company.fields.trnHint')}
                                    inputClassName="font-mono"
                                    optional
                                />
                            </FieldGroup>
                        </Section>

                        <Section
                            icon={PhoneIcon}
                            tone="from-success/70 to-success text-white"
                            title={t('configuration.company.sections.contact')}
                            description={t('configuration.company.sections.contactDescription')}
                        >
                            <FieldGroup className="gap-5">
                                <div className="grid gap-4 sm:grid-cols-3">
                                    <TextField {...bind('email')} type="email" label={t('configuration.company.fields.email')} optional />
                                    <TextField {...bind('phone')} type="tel" label={t('configuration.company.fields.phone')} placeholder="+971 4 000 0000" optional />
                                    <TextField {...bind('website')} type="url" label={t('configuration.company.fields.website')} placeholder="https://" optional />
                                </div>
                                <div className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4 ring-1 ring-foreground/[0.06]">
                                    <span className="text-sm font-semibold">{t('configuration.company.fields.contactPerson')}</span>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <TextField {...bind('contact_person_name')} label={t('configuration.company.fields.contactName')} inputClassName="bg-surface" optional />
                                        <TextField {...bind('contact_person_phone')} type="tel" label={t('configuration.company.fields.contactPhone')} inputClassName="bg-surface" optional />
                                        <TextField {...bind('contact_person_email')} type="email" label={t('configuration.company.fields.contactEmail')} inputClassName="bg-surface" optional />
                                    </div>
                                </div>
                            </FieldGroup>
                        </Section>

                        <Section
                            icon={MapPinIcon}
                            tone="from-chart-1 to-brand-navy text-white"
                            title={t('configuration.company.sections.address')}
                            description={t('configuration.company.sections.addressDescription')}
                        >
                            <FieldGroup className="gap-4">
                                <TextField {...bind('address_line_1')} label={t('configuration.company.fields.addressLine1')} optional />
                                <TextField {...bind('address_line_2')} label={t('configuration.company.fields.addressLine2')} optional />
                                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]">
                                    <TextField {...bind('city')} label={t('configuration.company.fields.city')} optional />
                                    <TextField {...bind('state')} label={t('configuration.company.fields.state')} optional />
                                    <TextField {...bind('postal_code')} label={t('configuration.company.fields.postalCode')} optional />
                                    <TextField {...bind('country_code')} label={t('configuration.company.fields.country')} maxLength={2} inputClassName="uppercase" />
                                </div>
                            </FieldGroup>
                        </Section>

                        <Section
                            icon={WalletIcon}
                            tone="from-warning/70 to-warning text-white"
                            title={t('configuration.company.sections.billing')}
                            description={t('configuration.company.sections.billingDescription')}
                        >
                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <SelectField
                                    {...bind('default_currency')}
                                    label={t('configuration.company.fields.currency')}
                                    items={currencies.map((code) => ({ value: code, label: code }))}
                                    description={t('configuration.company.fields.currencyHint')}
                                />
                                <SelectField {...bind('timezone')} label={t('configuration.company.fields.timezone')} items={timezones.map((zone) => ({ value: zone, label: zone.replace('_', ' ') }))} />
                            </FieldGroup>
                        </Section>
                    </div>

                    <aside className="flex flex-col gap-6 xl:sticky xl:top-20">
                        <BrandPreview data={data} logoUrl={logoUrl} />

                        <Card>
                            <CardHeader className="border-b">
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheckIcon className="size-4 text-brand-ink" />
                                    {t('configuration.company.account.title')}
                                </CardTitle>
                                <CardDescription>{t('configuration.company.account.description')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <dl className="flex flex-col gap-3 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">{t('configuration.company.account.status')}</dt>
                                        <dd>
                                            <Badge variant={STATUS_VARIANTS[company.status] ?? 'secondary'}>{t(`configuration.company.account.statuses.${company.status}`)}</Badge>
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="flex items-center gap-1.5 text-muted-foreground">
                                            <CalendarClockIcon className="size-3.5" />
                                            {t('configuration.company.account.expiry')}
                                        </dt>
                                        <dd className="font-medium">{company.expiry_date ? formatDate(company.expiry_date) : t('configuration.company.account.noExpiry')}</dd>
                                    </div>
                                    {company.created_at && (
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-muted-foreground">{t('configuration.company.account.since')}</dt>
                                            <dd className="font-medium">{formatDate(company.created_at)}</dd>
                                        </div>
                                    )}
                                </dl>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="border-b">
                                <CardTitle>{t('configuration.company.figures.title')}</CardTitle>
                                <CardDescription>{t('configuration.company.figures.description')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="grid grid-cols-2 gap-3">
                                    {tiles.map((tile) => (
                                        <li key={tile.label} className="flex flex-col gap-1 rounded-xl bg-muted/50 p-3 ring-1 ring-foreground/[0.06] last:col-span-2">
                                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <tile.icon className="size-3.5" />
                                                {tile.label}
                                            </span>
                                            <span className="font-heading text-xl font-bold tabular-nums">{formatNumber(tile.value)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </aside>
                </div>

                <FormActions>{actions}</FormActions>
            </form>
        </DashboardLayout>
    );
}
