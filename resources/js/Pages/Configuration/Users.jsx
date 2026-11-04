import FlashMessages from '@/Components/FlashMessages';
import PageHeader from '@/Components/PageHeader';
import { ListEmpty } from '@/Components/RecordList';
import { StaffAvatar } from '@/Components/StaffBadges';
import StatCard from '@/Components/StatCard';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { Head, Link } from '@inertiajs/react';
import { Building2Icon, ChevronRightIcon, ContactRoundIcon, CrownIcon, EyeIcon, SlidersHorizontalIcon, UserPlusIcon, UsersRoundIcon } from 'lucide-react';
import { FULL_ACCESS, roleIcon, useAccessName } from './Partials/UserAccess';

/**
 * One user in the list: who they are, their access and where it comes
 * from, how many permissions they have, and the way to their permissions.
 */
function UserRow({ user, available }) {
    const { t, formatNumber } = useTranslation();
    const accessName = useAccessName();
    const isFull = FULL_ACCESS.includes(user.kind);
    const share = available > 0 ? Math.min(100, (user.permissionCount / available) * 100) : 0;
    const source = isFull ? null : user.custom ? 'custom' : user.kind === 'staff' ? 'fromStaff' : 'fromRole';

    return (
        <li>
            <Link
                href={route('configuration.users.edit', user.id)}
                className="group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-5 sm:px-5 lg:px-6"
            >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                    <StaffAvatar name={user.name} />
                    <span className="flex min-w-0 flex-col">
                        <span className="flex min-w-0 items-center gap-2">
                            <span dir="auto" className="truncate text-sm font-medium group-hover:text-brand-ink">
                                {user.name}
                            </span>
                            {user.isYou && <Badge variant="info">{t('permissions.users.you')}</Badge>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </span>
                </span>

                <span className="flex flex-wrap items-center gap-2 sm:w-64 sm:shrink-0">
                    <Badge variant={isFull ? 'warning' : user.kind === 'staff' ? 'secondary' : 'info'}>
                        {(() => {
                            const Icon = isFull ? CrownIcon : user.kind === 'staff' ? ContactRoundIcon : roleIcon(user.role?.slug);

                            return <Icon data-icon="inline-start" />;
                        })()}
                        {accessName(user)}
                    </Badge>
                    {user.camps && (
                        <Badge variant={user.camps.length === 0 ? 'destructive' : 'outline'} title={user.camps.join(', ')}>
                            <Building2Icon data-icon="inline-start" />
                            {user.camps.length === 1 ? user.camps[0] : user.camps.length === 0 ? t('permissions.users.noCamps') : t('permissions.users.camps', { count: user.camps.length })}
                        </Badge>
                    )}
                    {source === 'custom' && (
                        <Badge variant="outline">
                            <SlidersHorizontalIcon data-icon="inline-start" />
                            {t('permissions.users.custom')}
                        </Badge>
                    )}
                </span>

                <span className="flex flex-col gap-1.5 sm:w-44 sm:shrink-0">
                    <span className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium tabular-nums">
                            {isFull ? t('permissions.users.everything') : t('permissions.users.count', { count: formatNumber(user.permissionCount), total: formatNumber(available) })}
                        </span>
                        {source && <span className="text-muted-foreground">{t(`permissions.users.${source}`)}</span>}
                    </span>
                    <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                            className={cn('block h-full rounded-full bg-linear-to-r from-brand-cyan to-brand-navy rtl:bg-linear-to-l', isFull && 'from-brand-sun to-gold')}
                            style={{ width: `${isFull ? 100 : share}%` }}
                        />
                    </span>
                </span>

                <span className="flex items-center gap-1 text-[0.8125rem] font-medium text-brand-ink sm:w-28 sm:justify-end">
                    {user.canEdit ? <SlidersHorizontalIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    {t(user.canEdit ? 'permissions.users.open' : 'permissions.users.view')}
                    <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </span>
            </Link>
        </li>
    );
}

/**
 * The company's users: the figures, everyone who can sign in with their
 * access, and the way to add a user. Adding a user and each user's
 * permissions open on their own pages.
 */
export default function Users({ users, available }) {
    const { t, formatNumber } = useTranslation();
    const title = t('permissions.users.title');
    const count = (...kinds) => users.filter((user) => kinds.includes(user.kind)).length;

    const addButton = (
        <Button variant="brand" nativeButton={false} render={<Link href={route('configuration.users.create')} />}>
            <UserPlusIcon data-icon="inline-start" />
            {t('permissions.users.add')}
        </Button>
    );

    return (
        <DashboardLayout>
            <Head title={title} />

            <PageHeader breadcrumbs={[{ label: t('nav.configuration') }, { label: title }]} title={title} count={users.length} description={t('permissions.users.description')} actions={addButton} />

            <FlashMessages />

            <section aria-label={t('permissions.users.stats.users')} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard icon={UsersRoundIcon} label={t('permissions.users.stats.users')} value={formatNumber(users.length)} detail={t('permissions.users.stats.usersDetail')} />
                <StatCard
                    icon={CrownIcon}
                    tone="gold"
                    label={t('permissions.users.stats.admins')}
                    value={formatNumber(count('super_admin', 'platform_admin'))}
                    detail={t('permissions.users.stats.adminsDetail')}
                />
                <StatCard
                    icon={SlidersHorizontalIcon}
                    tone="violet"
                    label={t('permissions.users.stats.custom')}
                    value={formatNumber(users.filter((user) => user.custom).length)}
                    detail={t('permissions.users.stats.customDetail')}
                />
                <StatCard icon={ContactRoundIcon} tone="success" label={t('permissions.users.stats.staff')} value={formatNumber(users.filter((user) => user.staffAccess !== null).length)} detail={t('permissions.users.stats.staffDetail')} />
            </section>

            <Card className="gap-0 overflow-hidden py-0">
                {users.length === 0 ? (
                    <ListEmpty icon={UsersRoundIcon} title={t('permissions.users.empty.title')} description={t('permissions.users.empty.description')} action={addButton} />
                ) : (
                    <ul className="flex flex-col divide-y">
                        {users.map((user) => (
                            <UserRow key={user.id} user={user} available={available} />
                        ))}
                    </ul>
                )}
            </Card>
        </DashboardLayout>
    );
}
