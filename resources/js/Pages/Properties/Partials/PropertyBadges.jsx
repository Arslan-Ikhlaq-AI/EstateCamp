import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import {
    CircleAlertIcon,
    FileCheckIcon,
    FileClockIcon,
    FileIcon,
    FileSignatureIcon,
    KeyRoundIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * Leases ending within this many days are flagged.
 */
const LEASE_WARNING_DAYS = 90;

export function StatusBadge({ status }) {
    const { t } = useTranslation();

    if (status === 'under_maintenance') {
        return (
            <Badge variant="warning">
                <WrenchIcon data-icon="inline-start" />
                {t('properties.status.under_maintenance')}
            </Badge>
        );
    }

    if (status === 'inactive') {
        return (
            <Badge variant="outline">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
                {t('status.inactive')}
            </Badge>
        );
    }

    return (
        <Badge variant="success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {t('status.active')}
        </Badge>
    );
}

export function OwnershipBadge({ ownership }) {
    const { t } = useTranslation();

    if (!ownership) {
        return <Badge variant="outline">{t('properties.ownership.unknown')}</Badge>;
    }

    const Icon = ownership === 'leased' ? FileSignatureIcon : KeyRoundIcon;

    return (
        <Badge variant="outline">
            <Icon data-icon="inline-start" />
            {t(`properties.ownership.${ownership}`)}
        </Badge>
    );
}

/**
 * When the lease ends, flagged once it is close or past. Owned properties
 * read "Freehold".
 */
export function LeaseNote({ property, className }) {
    const { t, formatDate } = useTranslation();

    if (property.ownership !== 'leased') {
        return property.ownership === 'owned' ? (
            <span className={cn('text-xs text-muted-foreground', className)}>
                {t('properties.lease.freehold')}
            </span>
        ) : null;
    }

    if (!property.leaseEndsOn) {
        return null;
    }

    const days = property.leaseDaysLeft;

    if (days < 0) {
        return (
            <span className={cn('flex items-center gap-1 text-xs font-medium text-destructive', className)}>
                <CircleAlertIcon className="size-3.5" />
                {t('properties.lease.ended', { date: formatDate(property.leaseEndsOn) })}
            </span>
        );
    }

    if (days <= LEASE_WARNING_DAYS) {
        return (
            <span className={cn('flex items-center gap-1 text-xs font-medium text-warning', className)}>
                <CircleAlertIcon className="size-3.5" />
                {t('properties.lease.endsIn', { count: days })}
            </span>
        );
    }

    return (
        <span className={cn('text-xs text-muted-foreground', className)}>
            {t('properties.lease.until', { date: formatDate(property.leaseEndsOn) })}
        </span>
    );
}

/**
 * Whether the property's documents are current, with the count on file in
 * a tooltip.
 */
export function ComplianceBadge({ documents }) {
    const { t } = useTranslation();

    let badge;

    if (documents.expired > 0) {
        badge = (
            <Badge variant="destructive">
                <FileClockIcon data-icon="inline-start" />
                {t('properties.compliance.expired', { count: documents.expired })}
            </Badge>
        );
    } else if (documents.expiring > 0) {
        badge = (
            <Badge variant="warning">
                <FileClockIcon data-icon="inline-start" />
                {t('properties.compliance.expiring', { count: documents.expiring })}
            </Badge>
        );
    } else if (documents.total > 0) {
        badge = (
            <Badge variant="success">
                <FileCheckIcon data-icon="inline-start" />
                {t('properties.compliance.valid')}
            </Badge>
        );
    } else {
        return (
            <Badge variant="outline">
                <FileIcon data-icon="inline-start" />
                {t('properties.compliance.none')}
            </Badge>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>{badge}</TooltipTrigger>
            <TooltipContent>
                {t('properties.compliance.onFile', { count: documents.total })}
            </TooltipContent>
        </Tooltip>
    );
}
