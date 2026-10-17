import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { getInitials } from '@/lib/format';

export default function CompanyCard({ company, className }) {
    const { t, formatDate } = useTranslation();

    const details = [
        { label: t('dashboard.company.tradeLicense'), value: company.tradeLicenseNumber },
        { label: t('dashboard.company.trn'), value: company.taxRegistrationNumber },
        {
            label: t('dashboard.company.licenseExpiry'),
            value: company.licenseExpiresOn && formatDate(company.licenseExpiresOn),
        },
        { label: t('dashboard.company.currency'), value: company.currency },
        { label: t('dashboard.company.timezone'), value: company.timezone },
    ].filter(({ value }) => value);

    return (
        <Card className={className}>
            <CardHeader className="border-b">
                <CardTitle>{t('dashboard.company.title')}</CardTitle>
                <CardDescription>{company.legalName ?? company.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <Avatar className="size-12 rounded-xl after:rounded-xl">
                        <AvatarImage src={company.logoUrl ?? undefined} alt="" className="rounded-xl" />
                        <AvatarFallback className="rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                            {getInitials(company.shortName ?? company.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate font-heading text-sm font-semibold">{company.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                            {[company.city, company.email].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                </div>
                <dl className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/[0.07]">
                    {details.map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="truncate font-medium tabular-nums" dir="auto">
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </CardContent>
        </Card>
    );
}
