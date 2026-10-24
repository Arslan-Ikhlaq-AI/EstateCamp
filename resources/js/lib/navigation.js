import {
    AirVentIcon,
    ArrowUpDownIcon,
    BadgeCheckIcon,
    BanknoteIcon,
    BedDoubleIcon,
    BriefcaseBusinessIcon,
    BugIcon,
    Building2Icon,
    CalendarCheck2Icon,
    CalendarCheckIcon,
    ChartColumnBigIcon,
    ChartPieIcon,
    ClipboardCheckIcon,
    CoinsIcon,
    ContactRoundIcon,
    CylinderIcon,
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
    PresentationIcon,
    ReceiptIcon,
    ReceiptTextIcon,
    ScaleIcon,
    SettingsIcon,
    ShapesIcon,
    SlidersHorizontalIcon,
    StampIcon,
    StoreIcon,
    TagsIcon,
    Trash2Icon,
    UserCogIcon,
    UserPlusIcon,
    UserRoundPlusIcon,
    UsersIcon,
    UsersRoundIcon,
    WalletCardsIcon,
    WalletIcon,
    WavesIcon,
    WrenchIcon,
} from 'lucide-react';
import { usePage } from '@inertiajs/react';

/**
 * The app's sections, shared by the sidebar, the command menu and page
 * headers (which show the current page's icon). A link is current on its own
 * route or on any route in `activeFor` (such as its add and edit pages);
 * `adminOnly` links show only to admins, and `ability` says who else may
 * open it (see canOpen). Links sharing a `heading` are grouped under it in
 * the sidebar.
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
                    { title: 'nav.allProperties', icon: Building2Icon, routeName: 'properties.index', activeFor: ['properties.index', 'properties.show', 'properties.create', 'properties.edit'] },
                    { title: 'nav.rooms', icon: DoorOpenIcon, routeName: 'rooms.index', activeFor: ['rooms.*'] },
                    { title: 'nav.shops', icon: StoreIcon, routeName: 'shops.index', activeFor: ['shops.*'] },
                    { title: 'nav.apartments', icon: HouseIcon, routeName: 'apartments.index', activeFor: ['apartments.*'] },
                ],
            },
            {
                title: 'nav.tenants',
                icon: UsersIcon,
                children: [
                    { title: 'nav.clients', icon: UsersIcon, routeName: 'clients.index', activeFor: ['clients.*'] },
                    { title: 'nav.occupants', icon: IdCardIcon, routeName: 'occupants.index', activeFor: ['occupants.*', 'occupancies.*'] },
                    { title: 'nav.contracts', icon: FileSignatureIcon, routeName: 'contracts.index', activeFor: ['contracts.*'] },
                    { title: 'nav.rentals', icon: KeyRoundIcon, routeName: 'rentals.index', activeFor: ['rentals.*'] },
                ],
            },
            {
                title: 'nav.landlordsMenu',
                icon: LandmarkIcon,
                children: [
                    { title: 'nav.allLandlords', icon: LandmarkIcon, routeName: 'landlords.index', activeFor: ['landlords.*'] },
                    { title: 'nav.headLeases', icon: FileKeyIcon, routeName: 'head-leases.index', activeFor: ['head-leases.*'] },
                ],
            },
            {
                title: 'nav.contractsMenu',
                icon: FileStackIcon,
                children: [
                    { title: 'nav.amcVisits', icon: CalendarCheckIcon, routeName: 'amc-visits.index', activeFor: ['amc-visits.*'] },
                    { title: 'nav.amcFireSafety', icon: FlameIcon, routeName: 'amcs.fire-safety', activeFor: ['amcs.fire-safety', 'amcs.fire-safety.*'] },
                    { title: 'nav.amcLifts', icon: ArrowUpDownIcon, routeName: 'amcs.lifts', activeFor: ['amcs.lifts', 'amcs.lifts.*'] },
                    { title: 'nav.amcGarbage', icon: Trash2Icon, routeName: 'amcs.garbage', activeFor: ['amcs.garbage', 'amcs.garbage.*'] },
                    { title: 'nav.amcGreaseTraps', icon: FilterIcon, routeName: 'amcs.grease-traps', activeFor: ['amcs.grease-traps', 'amcs.grease-traps.*'] },
                    { title: 'nav.amcDrainage', icon: WavesIcon, routeName: 'amcs.drainage', activeFor: ['amcs.drainage', 'amcs.drainage.*'] },
                    { title: 'nav.amcPestControl', icon: BugIcon, routeName: 'amcs.pest-control', activeFor: ['amcs.pest-control', 'amcs.pest-control.*'] },
                    { title: 'nav.amcAirConditioning', icon: AirVentIcon, routeName: 'amcs.air-conditioning', activeFor: ['amcs.air-conditioning', 'amcs.air-conditioning.*'] },
                    { title: 'nav.amcWaterTanks', icon: DropletsIcon, routeName: 'amcs.water-tanks', activeFor: ['amcs.water-tanks', 'amcs.water-tanks.*'] },
                ],
            },
            {
                title: 'nav.payments',
                icon: WalletIcon,
                children: [
                    { title: 'nav.paymentsOverview', icon: ChartPieIcon, routeName: 'payments.overview' },
                    { title: 'nav.invoices', icon: ReceiptTextIcon, routeName: 'invoices.index', activeFor: ['invoices.*'] },
                    { title: 'nav.gasBills', icon: CylinderIcon, routeName: 'gas-bills.index', activeFor: ['gas-bills.*'] },
                    { title: 'nav.paymentsReceived', icon: HandCoinsIcon, routeName: 'payments.index', activeFor: ['payments.index', 'payments.create', 'payments.show'] },
                    { title: 'nav.rentCollections', icon: ReceiptIcon, routeName: 'rental-payments.index', activeFor: ['rental-payments.*'] },
                    { title: 'nav.cheques', icon: WalletCardsIcon, routeName: 'cheques.index', activeFor: ['cheques.*'] },
                    { title: 'nav.maintenanceBills', icon: StampIcon, routeName: 'maintenance-bills.index', activeFor: ['maintenance-bills.*'] },
                    { title: 'nav.salaries', icon: CoinsIcon, routeName: 'salaries.index', activeFor: ['salaries.*'], ability: 'viewStaff' },
                ],
            },
            {
                title: 'nav.staffMenu',
                icon: ContactRoundIcon,
                children: [
                    { title: 'nav.allStaff', icon: ContactRoundIcon, routeName: 'staff.index', activeFor: ['staff.*'], ability: 'viewStaff' },
                    { title: 'nav.attendance', icon: CalendarCheckIcon, routeName: 'attendance.index', activeFor: ['attendance.*'], ability: 'viewStaff' },
                    { title: 'nav.payroll', icon: BanknoteIcon, routeName: 'payroll.index', activeFor: ['payroll.*'], ability: 'viewStaff' },
                ],
            },
            {
                title: 'nav.configuration',
                icon: SlidersHorizontalIcon,
                children: [
                    { title: 'nav.companyProfile', icon: BriefcaseBusinessIcon, routeName: 'configuration.company' },
                    { title: 'nav.propertyTypes', icon: TagsIcon, routeName: 'configuration.property-types' },
                    { title: 'nav.roomTypes', icon: BedDoubleIcon, routeName: 'configuration.room-types' },
                    { title: 'nav.maintenanceStatuses', icon: ListChecksIcon, routeName: 'configuration.maintenance-statuses' },
                    { title: 'nav.maintenanceCategories', icon: ShapesIcon, routeName: 'configuration.maintenance-categories' },
                    { title: 'nav.chequeStatuses', icon: ClipboardCheckIcon, routeName: 'configuration.cheque-statuses' },
                    { title: 'nav.staffRoles', icon: BadgeCheckIcon, routeName: 'configuration.staff-roles' },
                    { title: 'nav.regionalOffices', icon: MapPinnedIcon, routeName: 'configuration.regional-offices' },
                    { title: 'nav.users', icon: UserCogIcon, routeName: 'admin.dashboard', adminOnly: true },
                ],
            },
            {
                title: 'nav.maintenance',
                icon: WrenchIcon,
                routeName: 'maintenance.index',
                activeFor: ['maintenance.*'],
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
                    { title: 'nav.allReports', icon: LayoutGridIcon, routeName: 'reports.index' },
                    { title: 'nav.reportSummary', icon: PresentationIcon, routeName: 'reports.summary' },
                    { title: 'nav.reportIncome', icon: ScaleIcon, routeName: 'reports.income' },
                    { title: 'nav.reportReceivables', icon: HourglassIcon, routeName: 'reports.receivables' },
                    { title: 'nav.reportOccupancy', icon: BedDoubleIcon, routeName: 'reports.occupancy' },
                    { title: 'nav.reportMaintenance', icon: WrenchIcon, routeName: 'reports.maintenance' },
                    { title: 'nav.reportStaff', icon: UsersRoundIcon, routeName: 'reports.staff', ability: 'viewStaff' },
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
    { title: 'properties.add', icon: Building2Icon, routeName: 'properties.create', group: 'nav.properties' },
    { title: 'roomList.add', icon: DoorOpenIcon, routeName: 'rooms.create', group: 'nav.properties' },
    { title: 'apartmentList.add', icon: HouseIcon, routeName: 'apartments.create', group: 'nav.properties' },
    { title: 'shopList.add', icon: StoreIcon, routeName: 'shops.create', group: 'nav.properties' },
    { title: 'leasing.clients.add', icon: UsersIcon, routeName: 'clients.create', group: 'nav.tenants' },
    { title: 'leasing.occupants.add', icon: UserPlusIcon, routeName: 'occupants.create', group: 'nav.tenants' },
    { title: 'leasing.checkIn.button', icon: LogInIcon, routeName: 'occupancies.create', group: 'nav.tenants' },
    { title: 'leasing.contracts.add', icon: FileSignatureIcon, routeName: 'contracts.create', group: 'nav.tenants' },
    { title: 'finance.rentals.add', icon: KeyRoundIcon, routeName: 'rentals.create', group: 'nav.tenants' },
    { title: 'leasing.landlords.add', icon: LandmarkIcon, routeName: 'landlords.create', group: 'nav.landlordsMenu' },
    { title: 'leasing.headLeases.add', icon: FileKeyIcon, routeName: 'head-leases.create', group: 'nav.landlordsMenu' },
    { title: 'leasing.payments.add', icon: ReceiptIcon, routeName: 'payments.create', group: 'nav.payments' },
    { title: 'finance.gas.add', icon: CylinderIcon, routeName: 'gas-bills.create', group: 'nav.payments' },
    { title: 'maintenance.add', icon: WrenchIcon, routeName: 'maintenance.create', group: 'nav.maintenance' },
    { title: 'amcs.services.fire_safety.add', icon: FlameIcon, routeName: 'amcs.fire-safety.create', group: 'nav.contractsMenu' },
    { title: 'amcs.services.lifts.add', icon: ArrowUpDownIcon, routeName: 'amcs.lifts.create', group: 'nav.contractsMenu' },
    { title: 'amcs.services.garbage.add', icon: Trash2Icon, routeName: 'amcs.garbage.create', group: 'nav.contractsMenu' },
    { title: 'amcs.services.grease_traps.add', icon: FilterIcon, routeName: 'amcs.grease-traps.create', group: 'nav.contractsMenu' },
    { title: 'amcs.services.drainage.add', icon: WavesIcon, routeName: 'amcs.drainage.create', group: 'nav.contractsMenu' },
    { title: 'amcs.services.pest_control.add', icon: BugIcon, routeName: 'amcs.pest-control.create', group: 'nav.contractsMenu' },
    { title: 'amcs.services.air_conditioning.add', icon: AirVentIcon, routeName: 'amcs.air-conditioning.create', group: 'nav.contractsMenu' },
    { title: 'amcs.services.water_tanks.add', icon: DropletsIcon, routeName: 'amcs.water-tanks.create', group: 'nav.contractsMenu' },
    { title: 'staff.add', icon: UserRoundPlusIcon, routeName: 'staff.create', group: 'nav.staffMenu', ability: 'manageStaff' },
    { title: 'staff.actions.attendance', icon: CalendarCheckIcon, routeName: 'attendance.index', group: 'nav.staffMenu', ability: 'viewStaff' },
];

/**
 * Whether the user may open `link`, from what their sign-in allows
 * (`auth.access`). Its `ability` is `app` (the default: the rest of the
 * app), `viewStaff` (supervisors and staff admins), `manageStaff` (staff
 * admins), `self` (staff, for their own page) or `any`; `adminOnly` links
 * need an admin too.
 *
 * @param {{ ability?: string, adminOnly?: boolean }} link
 * @param {{ access: { app: boolean, staff: string, self: boolean } | null, isAdmin: boolean }} user
 */
export function canOpen(link, { access, isAdmin }) {
    if (link.adminOnly && !isAdmin) {
        return false;
    }

    switch (link.ability ?? 'app') {
        case 'any':
            return true;
        case 'self':
            return Boolean(access?.self);
        case 'viewStaff':
            return access?.staff === 'supervisor' || access?.staff === 'admin';
        case 'manageStaff':
            return access?.staff === 'admin';
        default:
            return Boolean(access?.app);
    }
}

/**
 * canOpen() for the signed-in user.
 *
 * @return {(link: { ability?: string, adminOnly?: boolean }) => boolean}
 */
export function useCanOpen() {
    const { auth } = usePage().props;
    const user = { access: auth.access, isAdmin: Boolean(auth.user?.is_admin) };

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
