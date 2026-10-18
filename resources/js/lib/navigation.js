import {
    AirVentIcon,
    ArrowUpDownIcon,
    BanknoteIcon,
    BedDoubleIcon,
    BriefcaseBusinessIcon,
    BugIcon,
    Building2Icon,
    DoorOpenIcon,
    DropletsIcon,
    FileKeyIcon,
    FileSignatureIcon,
    FileStackIcon,
    FilterIcon,
    FlameIcon,
    HandCoinsIcon,
    HouseIcon,
    IdCardIcon,
    LandmarkIcon,
    LayoutDashboardIcon,
    LifeBuoyIcon,
    LogInIcon,
    ReceiptIcon,
    ReceiptTextIcon,
    SettingsIcon,
    SlidersHorizontalIcon,
    StoreIcon,
    TagsIcon,
    Trash2Icon,
    UserCogIcon,
    UserPlusIcon,
    UsersIcon,
    WalletIcon,
    WavesIcon,
    WrenchIcon,
} from 'lucide-react';

/**
 * The app's sections, shared by the sidebar, the command menu and page
 * headers (which show the current page's icon). A link is current on its own
 * route or on any route in `activeFor` (such as its add and edit pages);
 * `adminOnly` links show only to admins. Links sharing a `heading` are
 * grouped under it in the sidebar.
 */
export const navigation = [
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
                    { title: 'nav.amcFireSafety', icon: FlameIcon, routeName: 'amcs.fire-safety' },
                    { title: 'nav.amcLifts', icon: ArrowUpDownIcon, routeName: 'amcs.lifts' },
                    { title: 'nav.amcGarbage', icon: Trash2Icon, routeName: 'amcs.garbage' },
                    { title: 'nav.amcGreaseTraps', icon: FilterIcon, routeName: 'amcs.grease-traps' },
                    { title: 'nav.amcDrainage', icon: WavesIcon, routeName: 'amcs.drainage' },
                    { title: 'nav.amcPestControl', icon: BugIcon, routeName: 'amcs.pest-control' },
                    { title: 'nav.amcAirConditioning', icon: AirVentIcon, routeName: 'amcs.air-conditioning' },
                    { title: 'nav.amcWaterTanks', icon: DropletsIcon, routeName: 'amcs.water-tanks' },
                ],
            },
            {
                title: 'nav.payments',
                icon: WalletIcon,
                children: [
                    { title: 'nav.invoices', icon: ReceiptTextIcon, routeName: 'invoices.index', activeFor: ['invoices.*'] },
                    { title: 'nav.paymentsReceived', icon: HandCoinsIcon, routeName: 'payments.index', activeFor: ['payments.*'] },
                    { title: 'nav.landlordPayments', icon: BanknoteIcon, routeName: 'landlord-payments.index', activeFor: ['landlord-payments.*'] },
                ],
            },
            {
                title: 'nav.configuration',
                icon: SlidersHorizontalIcon,
                children: [
                    { title: 'nav.companyProfile', icon: BriefcaseBusinessIcon, routeName: 'configuration.company' },
                    { title: 'nav.propertyTypes', icon: TagsIcon, routeName: 'configuration.property-types' },
                    { title: 'nav.roomTypes', icon: BedDoubleIcon, routeName: 'configuration.room-types' },
                    { title: 'nav.users', icon: UserCogIcon, routeName: 'admin.dashboard', adminOnly: true },
                ],
            },
            {
                title: 'nav.maintenance',
                icon: WrenchIcon,
                routeName: 'maintenance.index',
            },
        ],
    },
];

export const footerNavigation = [
    { title: 'nav.settings', icon: SettingsIcon, routeName: 'profile.edit' },
    { title: 'nav.help', icon: LifeBuoyIcon, routeName: 'help' },
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
    { title: 'leasing.landlords.add', icon: LandmarkIcon, routeName: 'landlords.create', group: 'nav.landlordsMenu' },
    { title: 'leasing.headLeases.add', icon: FileKeyIcon, routeName: 'head-leases.create', group: 'nav.landlordsMenu' },
    { title: 'leasing.payments.add', icon: ReceiptIcon, routeName: 'payments.create', group: 'nav.payments' },
];

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
 * @param {boolean} isAdmin
 * @return {Array<{ title: string, icon: import('react').ComponentType, routeName: string, section?: string }>}
 */
export function pageLinks(isAdmin) {
    const links = navigation.flatMap((group) =>
        group.items.flatMap((item) =>
            item.children
                ? item.children
                      .filter((child) => !child.adminOnly || isAdmin)
                      .map((child) => ({ title: child.title, icon: child.icon ?? item.icon, routeName: child.routeName, section: item.title }))
                : [{ title: item.title, icon: item.icon, routeName: item.routeName }],
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
            : isCurrentRoute(item.routeName) && item;

        if (match) {
            return match.icon ?? item.icon;
        }
    }

    return footerNavigation.find((item) => isCurrentRoute(item.routeName))?.icon ?? null;
}
