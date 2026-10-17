import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link, usePage } from '@inertiajs/react';
import { Building2Icon, DoorOpenIcon, LogInIcon } from 'lucide-react';
import AttentionCard from './Dashboard/Partials/AttentionCard';
import BedCapacity from './Dashboard/Partials/BedCapacity';
import CompanyCard from './Dashboard/Partials/CompanyCard';
import DocumentsCard from './Dashboard/Partials/DocumentsCard';
import KpiCards from './Dashboard/Partials/KpiCards';
import PortfolioPerformance from './Dashboard/Partials/PortfolioPerformance';
import PropertiesOverview from './Dashboard/Partials/PropertiesOverview';
import RoomsTable from './Dashboard/Partials/RoomsTable';
import TeamCard from './Dashboard/Partials/TeamCard';

function greetingKey(hour) {
    if (hour < 12) {
        return 'dashboard.greeting.morning';
    }

    return hour < 17 ? 'dashboard.greeting.afternoon' : 'dashboard.greeting.evening';
}

function Greeting({ company, summary }) {
    const { t, formatLongDate } = useTranslation();
    const { user } = usePage().props.auth;
    const now = new Date();
    const firstName = user.name.split(/\s+/)[0];

    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-1">
                <p className="text-[0.8125rem] font-medium text-muted-foreground">{formatLongDate(now)}</p>
                <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-9">
                    {t(greetingKey(now.getHours()), { name: firstName })}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {t('dashboard.subtitle', { company: company.name })}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-7 gap-1.5 bg-surface px-2.5 text-muted-foreground">
                    <Building2Icon data-icon="inline-start" />
                    {t('dashboard.portfolio', {
                        properties: t('dashboard.properties', { count: summary.properties }),
                        rooms: t('common.rooms', { count: summary.rooms }),
                    })}
                </Badge>
                <Button variant="outline" nativeButton={false} render={<Link href={route('rooms.index')} />}>
                    <DoorOpenIcon data-icon="inline-start" />
                    {t('nav.rooms')}
                </Button>
                <Button nativeButton={false} render={<Link href={route('occupancies.create')} />}>
                    <LogInIcon data-icon="inline-start" />
                    {t('leasing.checkIn.button')}
                </Button>
            </div>
        </div>
    );
}

function NoCompany() {
    const { t } = useTranslation();

    return (
        <Empty className="border bg-card py-16 shadow-(--card-shadow)">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Building2Icon />
                </EmptyMedia>
                <EmptyTitle>{t('dashboard.noCompany.title')}</EmptyTitle>
                <EmptyDescription>{t('dashboard.noCompany.description')}</EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}

export default function Dashboard({
    company,
    summary,
    properties,
    roomTypes,
    rooms,
    documents,
    team,
}) {
    const { t } = useTranslation();

    return (
        <DashboardLayout>
            <Head title={t('dashboard.title')} />

            {company === null ? (
                <NoCompany />
            ) : (
                <>
                    <Greeting company={company} summary={summary} />

                    <KpiCards summary={summary} currency={company.currency} />

                    <div className="grid items-start gap-6 xl:grid-cols-3">
                        <PortfolioPerformance
                            className="xl:col-span-2"
                            properties={properties}
                            rooms={rooms}
                            roomTypes={roomTypes}
                            summary={summary}
                            currency={company.currency}
                        />
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
                            <BedCapacity beds={summary.beds} />
                            <AttentionCard />
                        </div>
                    </div>

                    <div className="grid items-start gap-6 xl:grid-cols-3">
                        <PropertiesOverview
                            className="xl:col-span-2"
                            properties={properties}
                            currency={company.currency}
                        />
                        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
                            <TeamCard team={team} />
                            <CompanyCard company={company} />
                        </div>
                    </div>

                    <div className="grid items-start gap-6 xl:grid-cols-3">
                        <RoomsTable
                            className="xl:col-span-2"
                            rooms={rooms}
                            properties={properties}
                            currency={company.currency}
                        />
                        <DocumentsCard documents={documents} />
                    </div>
                </>
            )}
        </DashboardLayout>
    );
}
