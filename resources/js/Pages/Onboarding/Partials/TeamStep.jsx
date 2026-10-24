import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/format';
import { generatePassword } from '@/lib/onboarding';
import { cn } from '@/lib/utils';
import {
    BriefcaseBusinessIcon,
    CalculatorIcon,
    CrownIcon,
    MailIcon,
    MinusIcon,
    PlusIcon,
    ShieldCheckIcon,
    SmartphoneIcon,
    Trash2Icon,
    UserPlusIcon,
    UserRoundIcon,
    UsersRoundIcon,
} from 'lucide-react';
import { FieldSection, IconField, IconSelect, PasswordField } from './OnboardingFields';

export const ROLE_ICONS = { super_admin: CrownIcon, manager: BriefcaseBusinessIcon, accountant: CalculatorIcon };

/**
 * A person's initials on a gradient disc: gold for the super admin, brand blue for everyone else.
 */
export function PersonAvatar({ name, isOwner = false, className }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold text-white shadow-sm ring-2 ring-white',
                isOwner ? 'from-gold to-[#d68a00]' : 'from-brand-cyan to-brand-navy',
                className,
            )}
        >
            {name.trim() ? getInitials(name) : <UserRoundIcon className="size-4.5" />}
        </span>
    );
}

/**
 * How many teammates to add, with buttons to add or remove one.
 */
function TeamCounter({ count, max, onChange }) {
    return (
        <div className="flex items-center gap-1 rounded-full border bg-white p-1 shadow-xs" role="group" aria-label="Number of teammates">
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={() => onChange(count - 1)} disabled={count === 0} aria-label="Remove a teammate">
                <MinusIcon />
            </Button>
            <output aria-live="polite" className="min-w-8 text-center text-base font-bold tabular-nums text-brand-navy">
                {count}
            </output>
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={() => onChange(count + 1)} disabled={count >= max} aria-label="Add a teammate">
                <PlusIcon />
            </Button>
        </div>
    );
}

/**
 * Step 3: the super admin, then each teammate with their role.
 */
export default function TeamStep({ form, bind, roles, maxTeam, onTeamCountChange, onRemoveMember }) {
    const { team } = form.data;
    const roleItems = roles.map((role) => ({ value: role.value, label: role.name }));
    const people = 1 + team.length;
    const confirmation = bind('admin_password_confirmation');

    // A generated password fills both boxes, so it never needs typing twice.
    const generateAdminPassword = () => {
        const password = generatePassword();

        form.setData((values) => ({ ...values, admin_password: password, admin_password_confirmation: password }));
        form.validate({ only: ['admin_password', 'admin_password_confirmation'] });
    };

    return (
        <div className="flex flex-col gap-10">
            <FieldSection icon={CrownIcon} title="Super admin" description="Full access to every module and setting. Usually you.">
                <div className="flex flex-col gap-5 rounded-2xl border border-gold/40 bg-linear-to-br from-[#fffaf0] to-white p-5 shadow-xs">
                    <div className="flex items-center gap-3.5">
                        <PersonAvatar name={form.data.admin_name} isOwner />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-bold text-foreground">{form.data.admin_name.trim() || 'Your name'}</span>
                            <span className="truncate text-[0.8125rem] text-muted-foreground">{form.data.admin_email || 'name@company.com'}</span>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-bold text-gold-ink ring-1 ring-gold/30">
                            <CrownIcon className="size-3.5" aria-hidden="true" /> Super Admin
                        </span>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <IconField {...bind('admin_name')} label="Full name" icon={UserRoundIcon} autoComplete="name" placeholder="Alex Morgan" />
                        <IconField {...bind('admin_email')} label="Work email" icon={MailIcon} type="email" inputMode="email" autoComplete="username" placeholder="alex@company.com" description="Your sign-in details are sent here." />
                        <PasswordField
                            {...bind('admin_password')}
                            label="Password"
                            placeholder="At least 8 characters"
                            onGenerate={generateAdminPassword}
                            showStrength
                            description="You sign in with this; it is also in your welcome email."
                        />
                        <PasswordField
                            {...confirmation}
                            valid={confirmation.valid && confirmation.value === form.data.admin_password}
                            label="Confirm password"
                            placeholder="Type it again"
                        />
                        <IconField {...bind('admin_phone')} label="Mobile" icon={SmartphoneIcon} optional type="tel" autoComplete="tel" placeholder="+ country code and number" />
                    </div>
                </div>
            </FieldSection>

            <FieldSection icon={UsersRoundIcon} title="Teammates" description={`Add up to ${maxTeam} people now; staff can get their own sign-in later.`}>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
                    <p className="text-sm font-semibold text-foreground">How many people will join you?</p>
                    <TeamCounter count={team.length} max={maxTeam} onChange={onTeamCountChange} />
                </div>

                {team.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-8 text-center">
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-cyan/10 text-brand-ink">
                            <UserPlusIcon className="size-5" aria-hidden="true" />
                        </span>
                        <div className="flex flex-col gap-1">
                            <p className="font-bold text-foreground">Just you for now?</p>
                            <p className="max-w-sm text-[0.8125rem] text-muted-foreground">That works. Add managers or accountants here, or give staff their own sign-in later from the Staff pages.</p>
                        </div>
                        <Button type="button" variant="outline" onClick={() => onTeamCountChange(1)}>
                            <PlusIcon data-icon="inline-start" /> Add a teammate
                        </Button>
                    </div>
                ) : (
                    <ol className="flex flex-col gap-3">
                        {team.map((member, index) => (
                            <li
                                key={member.key}
                                className="group/member relative flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-xs transition-shadow focus-within:shadow-(--card-shadow) motion-safe:animate-enter"
                            >
                                <div className="flex items-center gap-3">
                                    <PersonAvatar name={member.name} className="size-9 text-xs" />
                                    <span className="flex-1 truncate text-sm font-bold text-foreground">{member.name.trim() || `Teammate ${index + 1}`}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => onRemoveMember(index)}
                                        aria-label={`Remove ${member.name.trim() || `teammate ${index + 1}`}`}
                                    >
                                        <Trash2Icon />
                                    </Button>
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <IconField {...bind(`team.${index}.name`)} label="Name" icon={UserRoundIcon} autoComplete="off" placeholder="Jordan Lee" />
                                    <IconField {...bind(`team.${index}.email`)} label="Email" icon={MailIcon} type="email" inputMode="email" autoComplete="off" placeholder="jordan@company.com" />
                                    <IconSelect {...bind(`team.${index}.role`)} label="Role" icon={ROLE_ICONS[member.role] ?? ShieldCheckIcon} items={roleItems} />
                                    <PasswordField
                                        {...bind(`team.${index}.password`)}
                                        label="Password"
                                        optional
                                        autoComplete="off"
                                        placeholder="Leave blank"
                                        onGenerate={() => bind(`team.${index}.password`).onChange(generatePassword())}
                                        description={member.password ? 'Sent to them in their welcome email.' : 'We create one and email it to them.'}
                                    />
                                </div>
                            </li>
                        ))}
                    </ol>
                )}

                {team.length > 0 && team.length < maxTeam && (
                    <Button type="button" variant="outline" className="h-11 border-dashed text-muted-foreground hover:text-foreground" onClick={() => onTeamCountChange(team.length + 1)}>
                        <UserPlusIcon data-icon="inline-start" /> Add another teammate
                    </Button>
                )}
                {form.errors.team && <p className="text-sm text-destructive">{form.errors.team}</p>}
            </FieldSection>

            <section aria-labelledby="roles-heading" className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="roles-heading" className="text-[0.95rem] font-bold tracking-tight text-foreground">
                        What each role can do
                    </h2>
                    <span className="text-[0.8125rem] font-semibold text-brand-ink">
                        {people} {people === 1 ? 'person' : 'people'} will get a sign-in
                    </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {roles.map((role) => {
                        const Icon = ROLE_ICONS[role.value] ?? ShieldCheckIcon;

                        return (
                            <div key={role.value} className="flex flex-col gap-2 rounded-2xl border bg-white p-4">
                                <span className={cn('flex size-8 items-center justify-center rounded-lg', role.value === 'super_admin' ? 'bg-gold/15 text-gold-ink' : 'bg-brand-cyan/10 text-brand-ink')}>
                                    <Icon className="size-4" aria-hidden="true" />
                                </span>
                                <p className="text-sm font-bold text-foreground">{role.name}</p>
                                <p className="text-[0.8125rem] leading-snug text-muted-foreground">{role.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
