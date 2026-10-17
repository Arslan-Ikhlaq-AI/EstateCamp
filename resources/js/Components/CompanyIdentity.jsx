import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';

/**
 * The signed-in user's company: its logo (initials when there is none), its
 * name and the user's role in it.
 */
export default function CompanyIdentity({ className }) {
    const { company, role } = usePage().props.auth;

    if (!company) {
        return null;
    }

    return (
        <div className={cn('flex min-w-0 items-center gap-3', className)}>
            <Avatar className="size-9 rounded-lg after:rounded-lg">
                <AvatarImage
                    src={company.logo_url ?? undefined}
                    alt=""
                    className="rounded-lg"
                />
                <AvatarFallback className="rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                    {getInitials(company.short_name ?? company.name)}
                </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 leading-tight">
                <span className="truncate font-heading text-sm font-semibold">
                    {company.name}
                </span>
                {role && (
                    <span className="truncate text-xs text-muted-foreground">
                        {role}
                    </span>
                )}
            </div>
        </div>
    );
}
