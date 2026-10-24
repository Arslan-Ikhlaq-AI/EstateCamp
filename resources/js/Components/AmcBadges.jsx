import { ToneBadge } from '@/Components/LeasingBadges';
import { useTranslation } from '@/hooks/use-translation';
import {
    AirVentIcon,
    AlarmSmokeIcon,
    AppWindowIcon,
    ArrowUpDownIcon,
    BedDoubleIcon,
    BellRingIcon,
    BirdIcon,
    BoxIcon,
    BugIcon,
    BugOffIcon,
    CalendarCheckIcon,
    CalendarClockIcon,
    CalendarXIcon,
    CctvIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleDotIcon,
    CircleSlashIcon,
    ClipboardCheckIcon,
    CloudFogIcon,
    CogIcon,
    ContainerIcon,
    CookingPotIcon,
    CylinderIcon,
    DatabaseIcon,
    Disc3Icon,
    DoorClosedIcon,
    FileTextIcon,
    FilterIcon,
    FireExtinguisherIcon,
    FlaskConicalIcon,
    GaugeIcon,
    LifeBuoyIcon,
    LightbulbIcon,
    PackageIcon,
    PhoneCallIcon,
    RatIcon,
    ReceiptIcon,
    RecycleIcon,
    ShieldIcon,
    ShieldPlusIcon,
    ShowerHeadIcon,
    SignpostIcon,
    SnowflakeIcon,
    SofaIcon,
    SparklesIcon,
    SprayCanIcon,
    TestTubeIcon,
    ThermometerSnowflakeIcon,
    Trash2Icon,
    TreePineIcon,
    TruckIcon,
    UtensilsIcon,
    WavesIcon,
    WindIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * The route of a maintenance contract page: `amcRoute('fire_safety')` is the
 * fire safety list (amcs.fire-safety), `amcRoute('fire_safety', 'show')` a
 * contract's page (amcs.fire-safety.show).
 */
export const amcRoute = (service, action) => `amcs.${service.replaceAll('_', '-')}${action ? `.${action}` : ''}`;

/**
 * The sidebar's short name for a kind of contract, for breadcrumbs:
 * `fire_safety` is nav.amcFireSafety ("Fire safety").
 */
export const amcNavTitle = (service) => `nav.amc${service.replace(/(^|_)(\w)/g, (match, separator, letter) => letter.toUpperCase())}`;

/**
 * An icon for each system or service a contract can cover, across every
 * kind of contract (see MaintenanceContract::COVERAGE).
 */
export const COVERAGE_ICONS = {
    fire_alarm: AlarmSmokeIcon,
    extinguishers: FireExtinguisherIcon,
    hose_reels: Disc3Icon,
    sprinklers: ShowerHeadIcon,
    fire_pumps: GaugeIcon,
    emergency_lighting: LightbulbIcon,
    exit_signs: SignpostIcon,
    gas_detection: WindIcon,
    kitchen_suppression: CookingPotIcon,
    fire_blankets: ShieldIcon,
    fire_doors: DoorClosedIcon,
    passenger_lifts: ArrowUpDownIcon,
    goods_lifts: PackageIcon,
    preventive_maintenance: WrenchIcon,
    breakdown_callouts: PhoneCallIcon,
    rescue_service: LifeBuoyIcon,
    spare_parts: CogIcon,
    lift_alarm: BellRingIcon,
    annual_inspection: ClipboardCheckIcon,
    general_waste: Trash2Icon,
    kitchen_waste: UtensilsIcon,
    recyclables: RecycleIcon,
    bulky_waste: SofaIcon,
    bins_supply: ContainerIcon,
    bin_washing: SprayCanIcon,
    disposal_fees: ReceiptIcon,
    trap_cleaning: FilterIcon,
    grease_removal: TruckIcon,
    line_jetting: WavesIcon,
    bio_dosing: FlaskConicalIcon,
    disposal_records: FileTextIcon,
    inspection_reports: ClipboardCheckIcon,
    septic_tanks: CylinderIcon,
    sewage_tanker: TruckIcon,
    manholes: CircleDotIcon,
    blockage_callouts: PhoneCallIcon,
    lifting_pumps: GaugeIcon,
    cctv_survey: CctvIcon,
    crawling_insects: BugIcon,
    bed_bugs: BedDoubleIcon,
    rodents: RatIcon,
    flies_mosquitoes: BugOffIcon,
    termites: TreePineIcon,
    birds: BirdIcon,
    fumigation: CloudFogIcon,
    kitchen_areas: CookingPotIcon,
    split_units: AirVentIcon,
    window_units: AppWindowIcon,
    package_units: BoxIcon,
    chillers: SnowflakeIcon,
    filter_cleaning: FilterIcon,
    coil_cleaning: SprayCanIcon,
    gas_refill: ThermometerSnowflakeIcon,
    duct_cleaning: WindIcon,
    roof_tanks: CylinderIcon,
    ground_tanks: DatabaseIcon,
    tank_cleaning: SparklesIcon,
    disinfection: ShieldPlusIcon,
    water_testing: TestTubeIcon,
    water_pumps: GaugeIcon,
    water_filters: FilterIcon,
};

/**
 * An icon for each status a contractor's visit can be in.
 */
export const VISIT_STATUS_ICONS = {
    scheduled: CalendarClockIcon,
    confirmed: CalendarCheckIcon,
    done: CircleCheckIcon,
    missed: CalendarXIcon,
    cancelled: CircleSlashIcon,
};

const VISIT_TONES = { scheduled: 'primary', confirmed: 'info', done: 'success', missed: 'danger', cancelled: 'muted' };

const STATE_TONES = { upcoming: 'primary', active: 'success', expiring: 'warning', expired: 'danger', cancelled: 'muted' };
const CERTIFICATE_TONES = { valid: 'success', expiring: 'warning', expired: 'danger' };

/**
 * Where a contract stands: upcoming, active, due for renewal, expired or cancelled.
 */
export function ContractStateBadge({ state }) {
    const { t } = useTranslation();

    return (
        <ToneBadge tone={STATE_TONES[state]} icon={state === 'expiring' ? CircleAlertIcon : undefined}>
            {t(`amcs.states.${state}`)}
        </ToneBadge>
    );
}

/**
 * Where a contractor's visit stands. A visit still to happen whose day has
 * passed reads as overdue.
 */
export function VisitStatusBadge({ status, alert }) {
    const { t } = useTranslation();

    if (alert === 'overdue') {
        return (
            <ToneBadge tone="danger" icon={CircleAlertIcon}>
                {t('amcs.visitStatuses.overdue')}
            </ToneBadge>
        );
    }

    return (
        <ToneBadge tone={VISIT_TONES[status]} icon={VISIT_STATUS_ICONS[status]}>
            {t(`amcs.visitStatuses.${status}`)}
        </ToneBadge>
    );
}

/**
 * Whether the certificate a contract keeps valid is valid, expiring soon or expired.
 */
export function CertificateBadge({ state }) {
    const { t } = useTranslation();

    return <ToneBadge tone={CERTIFICATE_TONES[state]}>{t(`amcs.certificateStates.${state}`)}</ToneBadge>;
}
