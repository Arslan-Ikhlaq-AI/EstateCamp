import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A company's logo, or its initials on the brand gradient.
 */
export default function CompanyMark({ company, className }) {
    return (
        <span
            className={cn(
                'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-brand-cyan to-brand-navy text-xs font-bold text-white shadow-sm ring-1 ring-foreground/10',
                className,
            )}
        >
            {company.logo_url ? <img src={company.logo_url} alt="" className="size-full bg-white object-contain p-1" /> : getInitials(company.name)}
        </span>
    );
}
