import {
    AirVentIcon,
    ArrowUpDownIcon,
    BadgeCheckIcon,
    BadgePercentIcon,
    BanknoteIcon,
    BedDoubleIcon,
    BriefcaseBusinessIcon,
    BugIcon,
    Building2Icon,
    CalendarCheck2Icon,
    CalendarCheckIcon,
    CalendarClockIcon,
    CalendarPlusIcon,
    ChartColumnBigIcon,
    ChartNoAxesCombinedIcon,
    ChartPieIcon,
    ClipboardCheckIcon,
    CoinsIcon,
    ContactRoundIcon,
    DoorOpenIcon,
    DropletsIcon,
    FileKeyIcon,
    FileSignatureIcon,
    FileStackIcon,
    FilterIcon,
    FlameIcon,
    HandCoinsIcon,
    HouseIcon,
    HourglassIcon,
    IdCardIcon,
    KeyRoundIcon,
    LandmarkIcon,
    LayoutDashboardIcon,
    LayoutGridIcon,
    LifeBuoyIcon,
    ListChecksIcon,
    LogInIcon,
    MapPinnedIcon,
    PlaneIcon,
    PresentationIcon,
    ReceiptIcon,
    ReceiptTextIcon,
    ScaleIcon,
    SettingsIcon,
    ShapesIcon,
    ShieldCheckIcon,
    SlidersHorizontalIcon,
    StampIcon,
    StoreIcon,
    TagsIcon,
    TreePalmIcon,
    Trash2Icon,
    UserCogIcon,
    UserPlusIcon,
    UserRoundIcon,
    UserRoundPlusIcon,
    UsersIcon,
    UsersRoundIcon,
    WalletCardsIcon,
    WalletIcon,
    WavesIcon,
    WrenchIcon,
} from 'lucide-react';
import { useCan } from '@/hooks/use-can';
import { usePage } from '@inertiajs/react';

/**
 * Every report's permission: the list of reports opens with any of them.
 */
const REPORT_PERMISSIONS = ['summary', 'income', 'receivables', 'occupancy', 'maintenance', 'staff'].map((report) => `report_${report}.view`);

/**
 * The app's sections, shared by the sidebar, the command menu and page
 * headers (which show the current page's icon). A link is current on its own
 * route or on any route in `activeFor` (such as its add and edit pages). It
 * shows to users with its `permission` (one of them, when a list), the
 * permission the server asks for on its route (see config/permissions.php);
 * `adminOnly` links show only to platform admins and `ability` marks the
 * links that need no permission (see canOpen). Links sharing a `heading` are
 * grouped under it in the sidebar.
 */
export const navigation = [
    {
        label: 'nav.mySection',
        items: [{ title: 'nav.myPage', icon: CalendarCheck2Icon, routeName: 'my.index', ability: 'self' }],
    },
    {
        label: 'nav.overview',
        items: [
            {
                title: 'nav.dashboard',
                icon: LayoutDashboardIcon,
                routeName: 'dashboard',
                permission: 'dashboard.view',
            },
            {
                title: 'nav.analyze',
                icon: ChartNoAxesCombinedIcon,
                routeName: 'analyze',
                permission: 'analyze.view',
            },
        ],
    },
    {
        label: 'nav.management',
        items: [
            {
                title: 'nav.properties',
                icon: Building2Icon,
                children: [
                    { title: 'nav.allProperties', icon: Building2Icon, routeName: 'properties.index', activeFor: ['properties.index', 'properties.show', 'properties.create', 'properties.edit'], permission: 'properties.view' },
                    { title: 'nav.rooms', icon: DoorOpenIcon, routeName: 'rooms.index', activeFor: ['rooms.*'], permission: 'rooms.view' },
                    { title: 'nav.shops', icon: StoreIcon, routeName: 'shops.index', activeFor: ['shops.*'], permission: 'shops.view' },
                    { title: 'nav.apartments', icon: HouseIcon, routeName: 'apartments.index', activeFor: ['apartments.*'], permission: 'apartments.view' },
                ],
            },
            {
                title: 'nav.tenants',
                icon: UsersIcon,
                children: [
                    { title: 'nav.clients', icon: UsersIcon, routeName: 'clients.index', activeFor: ['clients.*'], permission: 'clients.view' },
                    { title: 'nav.individuals', icon: UserRoundIcon, routeName: 'individuals.index', activeFor: ['individuals.*'], permission: 'individuals.view' },
                    { title: 'nav.occupants', icon: IdCardIcon, routeName: 'occupants.index', activeFor: ['occupants.*', 'occupancies.*'], permission: 'occupants.view' },
                    { title: 'nav.contracts', icon: FileSignatureIcon, routeName: 'contracts.index', activeFor: ['contracts.*'], permission: 'contracts.view' },
                    { title: 'nav.rentals', icon: KeyRoundIcon, routeName: 'rentals.index', activeFor: ['rentals.*'], permission: 'rentals.view' },
                ],
            },
            {
                title: 'nav.landlordsMenu',
                icon: LandmarkIcon,
                children: [
                    { title: 'nav.allLandlords', icon: LandmarkIcon, routeName: 'landlords.index', activeFor: ['landlords.*'], permission: 'landlords.view' },
                    { title: 'nav.headLeases', icon: FileKeyIcon, routeName: 'head-leases.index', activeFor: ['head-leases.*'], permission: 'head_leases.view' },
                ],
            },
            {
                title: 'nav.contractsMenu',
                icon: FileStackIcon,
                children: [
                    { title: 'nav.amcVisits', icon: CalendarCheckIcon, routeName: 'amc-visits.index', activeFor: ['amc-visits.*'], permission: 'amc_visits.view' },
                    { title: 'nav.amcFireSafety', icon: FlameIcon, routeName: 'amcs.fire-safety', activeFor: ['amcs.fire-safety', 'amcs.fire-safety.*'], permission: 'amc_fire_safety.view' },
                    { title: 'nav.amcLifts', icon: ArrowUpDownIcon, routeName: 'amcs.lifts', activeFor: ['amcs.lifts', 'amcs.lifts.*'], permission: 'amc_lifts.view' },
                    { title: 'nav.amcGarbage', icon: Trash2Icon, routeName: 'amcs.garbage', activeFor: ['amcs.garbage', 'amcs.garbage.*'], permission: 'amc_garbage.view' },
                    { title: 'nav.amcGreaseTraps', icon: FilterIcon, routeName: 'amcs.grease-traps', activeFor: ['amcs.grease-traps', 'amcs.grease-traps.*'], permission: 'amc_grease_traps.view' },
                    { title: 'nav.amcDrainage', icon: WavesIcon, routeName: 'amcs.drainage', activeFor: ['amcs.drainage', 'amcs.drainage.*'], permission: 'amc_drainage.view' },
                    { title: 'nav.amcPestControl', icon: BugIcon, routeName: 'amcs.pest-control', activeFor: ['amcs.pest-control', 'amcs.pest-control.*'], permission: 'amc_pest_control.view' },
                    { title: 'nav.amcAirConditioning', icon: AirVentIcon, routeName: 'amcs.air-conditioning', activeFor: ['amcs.air-conditioning', 'amcs.air-conditioning.*'], permission: 'amc_air_conditioning.view' },
                    { title: 'nav.amcWaterTanks', icon: DropletsIcon, routeName: 'amcs.water-tanks', activeFor: ['amcs.water-tanks', 'amcs.water-tanks.*'], permission: 'amc_water_tanks.view' },
                ],
            },
            {
                title: 'nav.payments',
                icon: WalletIcon,
                children: [
                    { title: 'nav.paymentsOverview', icon: ChartPieIcon, routeName: 'payments.overview', permission: 'payments_overview.view' },
                    { title: 'nav.invoices', icon: ReceiptTextIcon, routeName: 'invoices.index', activeFor: ['invoices.*'], permission: 'invoices.view' },
                    { title: 'nav.paymentsReceived', icon: HandCoinsIcon, routeName: 'payments.index', activeFor: ['payments.index', 'payments.create', 'payments.show'], permission: 'payments_received.view' },
                    { title: 'nav.rentCollections', icon: ReceiptIcon, routeName: 'rental-payments.index', activeFor: ['rental-payments.*'], permission: 'rent_collections.view' },
                    { title: 'nav.extraIncome', icon: BadgePercentIcon, routeName: 'extra-incomes.index', activeFor: ['extra-incomes.*'], permission: 'extra_income.view' },
                    { title: 'nav.cheques', icon: WalletCardsIcon, routeName: 'cheques.index', activeFor: ['cheques.*'], permission: 'cheques.view' },
                    { title: 'nav.maintenanceBills', icon: StampIcon, routeName: 'maintenance-bills.index', activeFor: ['maintenance-bills.*'], permission: 'maintenance_bills.view' },
                    { title: 'nav.salaries', icon: CoinsIcon, routeName: 'salaries.index', activeFor: ['salaries.*'], permission: 'salaries.view' },
                ],
            },
            {
                title: 'nav.staffMenu',
                icon: ContactRoundIcon,
                children: [
                    { title: 'nav.allStaff', icon: ContactRoundIcon, routeName: 'staff.index', activeFor: ['staff.*'], permission: 'staff.view' },
                    { title: 'nav.attendance', icon: CalendarCheckIcon, routeName: 'attendance.index', activeFor: ['attendance.*'], permission: 'attendance.view' },
                    { title: 'nav.leave', icon: TreePalmIcon, routeName: 'leave.index', activeFor: ['leave.*'], permission: 'leave.view' },
                    { title: 'nav.myAttendance', icon: CalendarClockIcon, routeName: 'my.attendance', ability: 'self' },
                    { title: 'nav.myLeave', icon: PlaneIcon, routeName: 'my.leave', activeFor: ['my.leave', 'my.leave.*'], ability: 'self' },
                    { title: 'nav.payroll', icon: BanknoteIcon, routeName: 'payroll.index', activeFor: ['payroll.*'], permission: 'payroll.view' },
                ],
            },
            {
                title: 'nav.configuration',
                icon: SlidersHorizontalIcon,
                children: [
                    { title: 'nav.companyProfile', icon: BriefcaseBusinessIcon, routeName: 'configuration.company', permission: 'company_profile.view' },
                    { title: 'nav.propertyTypes', icon: TagsIcon, routeName: 'configuration.property-types', permission: 'property_types.view' },
                    { title: 'nav.roomTypes', icon: BedDoubleIcon, routeName: 'configuration.room-types', permission: 'room_types.view' },
                    { title: 'nav.maintenanceStatuses', icon: ListChecksIcon, routeName: 'configuration.maintenance-statuses', permission: 'maintenance_statuses.view' },
                    { title: 'nav.maintenanceCategories', icon: ShapesIcon, routeName: 'configuration.maintenance-categories', permission: 'maintenance_categories.view' },
                    { title: 'nav.chequeStatuses', icon: ClipboardCheckIcon, routeName: 'configuration.cheque-statuses', permission: 'cheque_statuses.view' },
                    { title: 'nav.staffRoles', icon: BadgeCheckIcon, routeName: 'configuration.staff-roles', permission: 'staff_roles.view' },
                    { title: 'nav.regionalOffices', icon: MapPinnedIcon, routeName: 'configuration.regional-offices', permission: 'regional_offices.view' },
                    { title: 'nav.usersPermissions', icon: ShieldCheckIcon, routeName: 'configuration.users', activeFor: ['configuration.users', 'configuration.users.*'], permission: 'users.manage' },
                    { title: 'nav.users', icon: UserCogIcon, routeName: 'admin.dashboard', adminOnly: true, heading: 'nav.platform' },
                    { title: 'nav.companies', icon: Building2Icon, routeName: 'admin.companies.index', activeFor: ['admin.companies.*'], adminOnly: true, heading: 'nav.platform' },
                ],
            },
            {
                title: 'nav.maintenance',
                icon: WrenchIcon,
                routeName: 'maintenance.index',
                activeFor: ['maintenance.*'],
                permission: 'maintenance.view',
            },
        ],
    },
    {
        label: 'nav.insights',
        items: [
            {
                title: 'nav.reports',
                icon: ChartColumnBigIcon,
                children: [
                    { title: 'nav.allReports', icon: LayoutGridIcon, routeName: 'reports.index', permission: REPORT_PERMISSIONS },
                    { title: 'nav.reportSummary', icon: PresentationIcon, routeName: 'reports.summary', permission: 'report_summary.view' },
                    { title: 'nav.reportIncome', icon: ScaleIcon, routeName: 'reports.income', permission: 'report_income.view' },
                    { title: 'nav.reportReceivables', icon: HourglassIcon, routeName: 'reports.receivables', permission: 'report_receivables.view' },
                    { title: 'nav.reportOccupancy', icon: BedDoubleIcon, routeName: 'reports.occupancy', permission: 'report_occupancy.view' },
                    { title: 'nav.reportMaintenance', icon: WrenchIcon, routeName: 'reports.maintenance', permission: 'report_maintenance.view' },
                    { title: 'nav.reportStaff', icon: UsersRoundIcon, routeName: 'reports.staff', permission: 'report_staff.view' },
                ],
            },
        ],
    },
];

export const footerNavigation = [
    { title: 'nav.settings', icon: SettingsIcon, routeName: 'profile.edit', ability: 'any' },
    { title: 'nav.help', icon: LifeBuoyIcon, routeName: 'help', ability: 'any' },
];

/**
 * Shortcuts to the "add" pages, for the header's Create menu and the
 * command menu. They need a company, like the add buttons on each list.
 */
export const createActions = [
    { title: 'properties.add', icon: Building2Icon, routeName: 'properties.create', group: 'nav.properties', permission: 'properties.create' },
    { title: 'roomList.add', icon: DoorOpenIcon, routeName: 'rooms.create', group: 'nav.properties', permission: 'rooms.create' },
    { title: 'apartmentList.add', icon: HouseIcon, routeName: 'apartments.create', group: 'nav.properties', permission: 'apartments.create' },
    { title: 'shopList.add', icon: StoreIcon, routeName: 'shops.create', group: 'nav.properties', permission: 'shops.create' },
    { title: 'leasing.clients.add', icon: UsersIcon, routeName: 'clients.create', group: 'nav.tenants', permission: 'clients.create' },
    { title: 'leasing.occupants.add', icon: UserPlusIcon, routeName: 'occupants.create', group: 'nav.tenants', permission: 'occupants.create' },
    { title: 'leasing.checkIn.button', icon: LogInIcon, routeName: 'occupancies.create', group: 'nav.tenants', permission: 'occupants.check_in' },
    { title: 'leasing.contracts.add', icon: FileSignatureIcon, routeName: 'contracts.create', group: 'nav.tenants', permission: 'contracts.create' },
    { title: 'finance.rentals.add', icon: KeyRoundIcon, routeName: 'rentals.create', group: 'nav.tenants', permission: 'rentals.create' },
    { title: 'leasing.landlords.add', icon: LandmarkIcon, routeName: 'landlords.create', group: 'nav.landlordsMenu', permission: 'landlords.create' },
    { title: 'leasing.headLeases.add', icon: FileKeyIcon, routeName: 'head-leases.create', group: 'nav.landlordsMenu', permission: 'head_leases.create' },
    { title: 'leasing.payments.add', icon: ReceiptIcon, routeName: 'payments.create', group: 'nav.payments', permission: 'payments_received.create' },
    { title: 'maintenance.add', icon: WrenchIcon, routeName: 'maintenance.create', group: 'nav.maintenance', permission: 'maintenance.create' },
    { title: 'amcs.services.fire_safety.add', icon: FlameIcon, routeName: 'amcs.fire-safety.create', group: 'nav.contractsMenu', permission: 'amc_fire_safety.create' },
    { title: 'amcs.services.lifts.add', icon: ArrowUpDownIcon, routeName: 'amcs.lifts.create', group: 'nav.contractsMenu', permission: 'amc_lifts.create' },
    { title: 'amcs.services.garbage.add', icon: Trash2Icon, routeName: 'amcs.garbage.create', group: 'nav.contractsMenu', permission: 'amc_garbage.create' },
    { title: 'amcs.services.grease_traps.add', icon: FilterIcon, routeName: 'amcs.grease-traps.create', group: 'nav.contractsMenu', permission: 'amc_grease_traps.create' },
    { title: 'amcs.services.drainage.add', icon: WavesIcon, routeName: 'amcs.drainage.create', group: 'nav.contractsMenu', permission: 'amc_drainage.create' },
    { title: 'amcs.services.pest_control.add', icon: BugIcon, routeName: 'amcs.pest-control.create', group: 'nav.contractsMenu', permission: 'amc_pest_control.create' },
    { title: 'amcs.services.air_conditioning.add', icon: AirVentIcon, routeName: 'amcs.air-conditioning.create', group: 'nav.contractsMenu', permission: 'amc_air_conditioning.create' },
    { title: 'amcs.services.water_tanks.add', icon: DropletsIcon, routeName: 'amcs.water-tanks.create', group: 'nav.contractsMenu', permission: 'amc_water_tanks.create' },
    { title: 'staff.add', icon: UserRoundPlusIcon, routeName: 'staff.create', group: 'nav.staffMenu', permission: 'staff.create' },
    { title: 'staff.actions.attendance', icon: CalendarCheckIcon, routeName: 'attendance.index', group: 'nav.staffMenu', permission: 'attendance.view' },
    { title: 'staff.leave.give', icon: CalendarPlusIcon, routeName: 'leave.create', group: 'nav.staffMenu', permission: 'leave.manage' },
];

/**
 * Whether the user may open `link`: platform admins its `adminOnly` links,
 * anyone its `any` links, staff members their own (`self`) pages, and
 * otherwise whoever has its `permission` (any of them, when a list). A link
 * with none of these is offered to no one.
 *
 * @param {{ permission?: string | string[], ability?: string, adminOnly?: boolean }} link
 * @param {{ can: (...permissions: string[]) => boolean, access: { self: boolean } | null, isAdmin: boolean }} user
 */
export function canOpen(link, { can, access, isAdmin }) {
    if (link.adminOnly) {
        return isAdmin;
    }

    if (link.ability === 'any') {
        return true;
    }

    if (link.ability === 'self') {
        return Boolean(access?.self);
    }

    return link.permission !== undefined && can(...[link.permission].flat());
}

/**
 * canOpen() for the signed-in user.
 *
 * @return {(link: { permission?: string | string[], ability?: string, adminOnly?: boolean }) => boolean}
 */
export function useCanOpen() {
    const { auth } = usePage().props;
    const can = useCan();
    const user = { can, access: auth.access, isAdmin: Boolean(auth.user?.is_admin) };

    return (link) => canOpen(link, user);
}

/**
 * Whether the current page is `routeName` or one of `activeFor`.
 *
 * @param {string} routeName
 * @param {string[]} [activeFor]
 */
export const isCurrentRoute = (routeName, activeFor = [routeName]) => activeFor.some((name) => route().current(name));

/**
 * Every page link the user can open, flattened with the section it sits in.
 *
 * @param {(link: object) => boolean} canOpenLink  from useCanOpen()
 * @return {Array<{ title: string, icon: import('react').ComponentType, routeName: string, section?: string }>}
 */
export function pageLinks(canOpenLink) {
    const links = navigation.flatMap((group) =>
        group.items.flatMap((item) =>
            item.children
                ? item.children
                      .filter(canOpenLink)
                      .map((child) => ({ title: child.title, icon: child.icon ?? item.icon, routeName: child.routeName, section: item.title }))
                : canOpenLink(item)
                  ? [{ title: item.title, icon: item.icon, routeName: item.routeName }]
                  : [],
        ),
    );

    return [...links, ...footerNavigation];
}

/**
 * The icon of the page being viewed, from its link in the navigation.
 *
 * @return {import('react').ComponentType | null}
 */
export function currentPageIcon() {
    for (const item of navigation.flatMap((group) => group.items)) {
        const match = item.children
            ? item.children.find((child) => isCurrentRoute(child.routeName, child.activeFor))
            : isCurrentRoute(item.routeName, item.activeFor) && item;

        if (match) {
            return match.icon ?? item.icon;
        }
    }

    return footerNavigation.find((item) => isCurrentRoute(item.routeName))?.icon ?? null;
}
