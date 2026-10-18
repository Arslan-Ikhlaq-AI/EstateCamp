import { PageBreadcrumbs } from '@/Components/HeaderBreadcrumbs';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { useTranslation } from '@/hooks/use-translation';
import { Head, Link } from '@inertiajs/react';
import {
    AirVentIcon,
    ArrowLeftIcon,
    ArrowUpDownIcon,
    BugIcon,
    DropletsIcon,
    FilterIcon,
    FlameIcon,
    Trash2Icon,
    WavesIcon,
    BedDoubleIcon,
    FileTextIcon,
    LandmarkIcon,
    LifeBuoyIcon,
    SparklesIcon,
    TagsIcon,
    WrenchIcon,
} from 'lucide-react';

const SECTIONS = {
    'properties.documents': { icon: FileTextIcon, parent: 'nav.properties' },
    'configuration.company': { icon: LandmarkIcon, parent: 'nav.configuration' },
    'configuration.property-types': { icon: TagsIcon, parent: 'nav.configuration' },
    'configuration.room-types': { icon: BedDoubleIcon, parent: 'nav.configuration' },
    'maintenance.index': { icon: WrenchIcon },
    'amcs.fire-safety': { icon: FlameIcon, parent: 'nav.contractsMenu' },
    'amcs.lifts': { icon: ArrowUpDownIcon, parent: 'nav.contractsMenu' },
    'amcs.garbage': { icon: Trash2Icon, parent: 'nav.contractsMenu' },
    'amcs.grease-traps': { icon: FilterIcon, parent: 'nav.contractsMenu' },
    'amcs.drainage': { icon: WavesIcon, parent: 'nav.contractsMenu' },
    'amcs.pest-control': { icon: BugIcon, parent: 'nav.contractsMenu' },
    'amcs.air-conditioning': { icon: AirVentIcon, parent: 'nav.contractsMenu' },
    'amcs.water-tanks': { icon: DropletsIcon, parent: 'nav.contractsMenu' },
    help: { icon: LifeBuoyIcon },
};

export default function ComingSoon({ section }) {
    const { t } = useTranslation();
    const { icon: Icon, parent, parentRoute } = SECTIONS[section] ?? { icon: SparklesIcon };
    const title = t(['comingSoon', 'sections', section, 'title']);

    return (
        <DashboardLayout>
            <Head title={title} />
            <PageBreadcrumbs crumbs={[...(parent ? [{ label: t(parent) }] : []), { label: title }]} />

            <Empty className="border bg-card py-20 shadow-(--card-shadow)">
                <EmptyHeader className="max-w-md">
                    <EmptyMedia variant="icon" className="mb-3 size-14 text-primary [&_svg:not([class*='size-'])]:size-6">
                        <Icon />
                    </EmptyMedia>
                    <Badge variant="warning" className="mb-1">
                        <SparklesIcon data-icon="inline-start" />
                        {t('comingSoon.badge')}
                    </Badge>
                    <EmptyTitle className="text-2xl">
                        {title}
                    </EmptyTitle>
                    <EmptyDescription className="text-base">
                        {t(['comingSoon', 'sections', section, 'description'])}
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button
                        nativeButton={false}
                        render={<Link href={route(parentRoute ?? 'dashboard')} />}
                    >
                        <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
                        {parentRoute
                            ? t('common.backTo', { page: t(parent) })
                            : t('common.backToDashboard')}
                    </Button>
                </EmptyContent>
            </Empty>
        </DashboardLayout>
    );
}
