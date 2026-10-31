import { DetailList, SectionCard } from '@/Components/DetailCards';
import { PartyTypeBadge } from '@/Components/LeasingBadges';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { Link } from '@inertiajs/react';
import { Building2Icon, ChevronRightIcon, UserIcon } from 'lucide-react';

/**
 * One titled group of the card, set apart from the one above by a rule.
 */
function Group({ title, children }) {
    return (
        <section className="flex flex-col gap-3 border-t pt-5">
            <h3 className="text-[0.8125rem] font-semibold">{title}</h3>
            {children}
        </section>
    );
}

/**
 * Who the property is leased from: how to reach them, their registration
 * and bank details, any notes, and the other properties the company leases
 * from them, each linking to its page. A missing detail shows a dash. Laid
 * out for a full-width card: the contact, registration and bank groups sit
 * side by side when there is room.
 */
export default function LandlordCard({ landlord }) {
    const { t } = useTranslation();
    const isCompany = landlord.type === 'company';

    return (
        <SectionCard
            title={t('propertyShow.landlord.title')}
            action={
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={route('landlords.show', landlord.id)} />}>
                    {t('propertyShow.landlord.view')}
                </Button>
            }
        >
            <div className="@container flex flex-col gap-5">
                <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary dark:bg-primary/20 dark:text-brand-cyan">
                        {isCompany ? <Building2Icon className="size-4.5" /> : <UserIcon className="size-4.5" />}
                    </span>
                    <div className="flex min-w-0 flex-col items-start gap-1.5">
                        <Link href={route('landlords.show', landlord.id)} dir="auto" className="text-sm font-semibold hover:text-brand-ink">
                            {landlord.name}
                        </Link>
                        <PartyTypeBadge type={landlord.type} />
                    </div>
                </div>

                <div className="grid gap-x-8 gap-y-5 @2xl:grid-cols-2 @5xl:grid-cols-3">
                    <Group title={t('leasing.landlords.form.contact.title')}>
                        <DetailList
                            columns={1}
                            rows={[
                                { label: t('leasing.landlords.form.fields.contactPerson'), value: landlord.contactName },
                                {
                                    label: t('leasing.landlords.form.fields.phone'),
                                    value: landlord.phone && (
                                        <a href={`tel:${landlord.phone}`} dir="ltr" className="text-brand-ink hover:underline">
                                            {landlord.phone}
                                        </a>
                                    ),
                                },
                                {
                                    label: t('leasing.landlords.form.fields.email'),
                                    value: landlord.email && (
                                        <a href={`mailto:${landlord.email}`} className="text-brand-ink hover:underline">
                                            {landlord.email}
                                        </a>
                                    ),
                                },
                                { label: t('leasing.landlords.form.fields.address'), value: landlord.address && <span dir="auto">{landlord.address}</span> },
                            ]}
                        />
                    </Group>
    
                    <Group title={t('leasing.landlords.show.details')}>
                        <DetailList
                            columns={1}
                            rows={[
                                isCompany
                                    ? { label: t('leasing.landlords.form.fields.tradeLicense'), value: landlord.tradeLicenseNumber }
                                    : { label: t('leasing.landlords.form.fields.idNumber'), value: landlord.idNumber },
                                { label: t('leasing.landlords.form.fields.trn'), value: landlord.taxRegistrationNumber },
                            ]}
                        />
                    </Group>
    
                    <Group title={t('leasing.landlords.form.bank.title')}>
                        <DetailList
                            columns={1}
                            rows={[
                                { label: t('leasing.landlords.form.fields.bankName'), value: landlord.bankName },
                                { label: t('leasing.landlords.form.fields.accountName'), value: landlord.accountName && <span dir="auto">{landlord.accountName}</span> },
                                {
                                    label: t('leasing.landlords.form.fields.iban'),
                                    value: landlord.iban && (
                                        <span dir="ltr" className="font-mono">
                                            {landlord.iban}
                                        </span>
                                    ),
                                },
                            ]}
                        />
                    </Group>
                </div>

                {landlord.notes && (
                    <Group title={t('leasing.common.notes')}>
                        <p dir="auto" className="text-sm leading-relaxed whitespace-pre-line">
                            {landlord.notes}
                        </p>
                    </Group>
                )}

                <Group title={t('propertyShow.landlord.otherProperties')}>
                    {landlord.properties.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('propertyShow.landlord.noOtherProperties')}</p>
                    ) : (
                        <ul className="grid gap-2.5 @2xl:grid-cols-2 @5xl:grid-cols-3">
                            {landlord.properties.map((property) => (
                                <li key={property.id}>
                                    <Link
                                        href={route('properties.show', property.id)}
                                        className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 ring-1 ring-foreground/[0.08] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                                    >
                                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                            <span dir="auto" className="truncate text-sm font-medium">
                                                {property.name}
                                            </span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                <span className="font-mono">{property.code}</span>
                                                {[property.area, property.city].filter(Boolean).map((part) => ` · ${part}`)}
                                            </span>
                                        </div>
                                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                            {property.roomOccupancy.total > 0
                                                ? t('properties.occupancy.rooms', { occupied: property.roomOccupancy.occupied, total: property.roomOccupancy.total })
                                                : t('properties.occupancy.noRooms')}
                                        </span>
                                        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Group>
            </div>
        </SectionCard>
    );
}
