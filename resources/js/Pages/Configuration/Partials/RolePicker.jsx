import { FieldError } from '@/components/ui/field';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { LockIcon, UserRoundXIcon } from 'lucide-react';
import { roleIcon } from './UserAccess';

/**
 * The roles on offer as cards, each with what it is for and how many
 * permissions it brings, and for a staff sign-in, no role at all. A role
 * the signed-in user may not give stays shut, unless it is the one the user
 * already has.
 */
export default function RolePicker({ roles, value, current = null, allowNone = false, disabled = false, error, onChange }) {
    const { t, tOr, formatNumber } = useTranslation();
    const options = allowNone
        ? [{ value: null, name: t('permissions.user.noRole'), description: t('permissions.user.noRoleDescription'), givable: true, permissions: null }, ...roles]
        : roles;

    return (
        <div role="radiogroup" aria-label={t('permissions.user.roleSection')} className="flex flex-col gap-2">
            {options.map((role) => {
                const isChosen = role.value === value;
                const isShut = disabled || (!role.givable && role.value !== current);
                const Icon = role.value === null ? UserRoundXIcon : roleIcon(role.value);

                return (
                    <button
                        key={role.value ?? 'none'}
                        type="button"
                        role="radio"
                        aria-checked={isChosen}
                        disabled={isShut}
                        title={isShut && !disabled ? t('permissions.users.cannotGive') : undefined}
                        onClick={() => onChange(role.value)}
                        className={cn(
                            'flex items-start gap-3 rounded-xl p-3 text-start ring-1 ring-foreground/10 transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50 enabled:hover:bg-muted/50 disabled:cursor-not-allowed',
                            isChosen && 'bg-brand-cyan/[0.07] ring-2 ring-brand-cyan/60 enabled:hover:bg-brand-cyan/10',
                            isShut && !isChosen && 'opacity-55',
                        )}
                    >
                        <span
                            className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-white shadow-sm',
                                role.value === 'super_admin' ? 'from-brand-sun to-gold text-brand-navy' : role.value === null ? 'from-muted-foreground/60 to-muted-foreground' : 'from-brand-cyan to-brand-navy',
                            )}
                        >
                            <Icon className="size-4" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                                {role.value === null ? role.name : tOr(`permissions.roles.${role.value}.name`, role.name)}
                                {isShut && !isChosen ? (
                                    <LockIcon className="size-3.5 text-muted-foreground" />
                                ) : (
                                    role.permissions && <span className="text-xs font-normal text-muted-foreground tabular-nums">{formatNumber(role.permissions.length)}</span>
                                )}
                            </span>
                            <span className="text-xs text-pretty text-muted-foreground">
                                {role.value === null ? role.description : tOr(`permissions.roles.${role.value}.description`, role.description)}
                            </span>
                        </span>
                    </button>
                );
            })}
            <FieldError>{error}</FieldError>
        </div>
    );
}
