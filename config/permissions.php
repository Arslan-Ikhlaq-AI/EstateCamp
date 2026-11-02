<?php

use App\Http\Controllers\MaintenanceContractController;
use App\Models\MaintenanceContract;
use App\Models\UserRole;

/*
|--------------------------------------------------------------------------
| Permissions
|--------------------------------------------------------------------------
|
| Who may open what, in two layers.
|
| Company permissions: every page below can be switched off for a company
| from the platform admin's Companies page (stored in the company's
| `disabled_features`). A switched-off page is gone for everyone in that
| company, whatever their own permissions say.
|
| User permissions: each page lists what can be done on it, and each of
| those is one permission, named "{page}.{action}" (such as `rooms.create`).
| A user gets their role's defaults below, or the list their company's
| admin chose for them on the Users & permissions page.
|
| Camp permissions: area managers and camp bosses see only the properties
| given to them, and everything at them (see User::campPropertyIds()).
| Pages that add up the whole company (`company_wide`) are never theirs.
|
| Each action lists the routes it opens, and the `permission` middleware
| refuses any of them to a user without it. A route listed under several
| actions opens to anyone with one of them. Routes left out are open to
| every signed-in user (see `open_routes`); a test checks that no other
| route is missed.
|
*/

$amcPages = collect(MaintenanceContract::SERVICES)->mapWithKeys(function (string $service): array {
    $name = MaintenanceContractController::routeName($service);

    return ["amc_{$service}" => [
        'view' => [$name, "{$name}.show", "{$name}.document"],
        'create' => ["{$name}.create", "{$name}.store"],
        'edit' => ["{$name}.edit", "{$name}.update"],
    ]];
})->all();

/*
| What area managers and camp bosses do at their camps: see them, let and
| check in, collect rent and cash, and look after maintenance and the
| attendance of the staff there.
*/
$campWork = [
    'dashboard.view', 'analyze.view',
    'properties.view', 'rooms.view', 'rooms.edit', 'shops.view', 'shops.edit', 'apartments.view', 'apartments.edit',
    'clients.view', 'clients.create', 'individuals.view', 'occupants.*', 'contracts.view', 'contracts.create', 'contracts.edit', 'rentals.*',
    'amc_visits.view',
    'invoices.view', 'payments_received.view', 'payments_received.create', 'rent_collections.view', 'rent_collections.create',
    'extra_income.view', 'extra_income.create', 'cheques.view', 'maintenance_bills.view', 'maintenance_bills.pay',
    'property_payments.view', 'other_payments.view', 'other_payments.create',
    'staff.view', 'attendance.*',
    'maintenance.*',
    'report_occupancy.view', 'report_maintenance.view',
];

$reportPages = collect(['summary', 'income', 'receivables', 'occupancy', 'maintenance', 'staff'])->mapWithKeys(fn (string $report): array => [
    // The list of reports opens to anyone who may read one of them.
    "report_{$report}" => ['view' => ['reports.index', "reports.{$report}"]],
])->all();

return [

    /*
    | The top menus (modules), each with its pages and every page's actions.
    | The order here is the order the permission screens show them in.
    */
    'modules' => [
        'overview' => [
            // The dashboard sends anyone without it to a page they may open, so it lists no route.
            'dashboard' => ['view' => []],
            'analyze' => ['view' => ['analyze']],
        ],

        'properties' => [
            'properties' => [
                'view' => ['properties.index', 'properties.show', 'properties.allocation'],
                'create' => ['properties.create', 'properties.store'],
                'edit' => ['properties.edit', 'properties.update'],
            ],
            'rooms' => [
                'view' => ['rooms.index'],
                'create' => ['rooms.create', 'rooms.store'],
                'edit' => ['rooms.edit', 'rooms.update'],
            ],
            'shops' => [
                'view' => ['shops.index', 'shops.show'],
                'create' => ['shops.create', 'shops.store'],
                'edit' => ['shops.edit', 'shops.update'],
            ],
            'apartments' => [
                'view' => ['apartments.index', 'apartments.show'],
                'create' => ['apartments.create', 'apartments.store'],
                'edit' => ['apartments.edit', 'apartments.update'],
            ],
        ],

        'tenants' => [
            'clients' => [
                'view' => ['clients.index', 'clients.show'],
                'create' => ['clients.create', 'clients.store'],
                'edit' => ['clients.edit', 'clients.update'],
            ],
            'individuals' => [
                'view' => ['individuals.index'],
            ],
            'occupants' => [
                'view' => ['occupants.index', 'occupants.show'],
                'create' => ['occupants.create', 'occupants.store'],
                'edit' => ['occupants.edit', 'occupants.update'],
                'check_in' => ['occupancies.create', 'occupancies.store', 'occupancies.check-out'],
            ],
            'contracts' => [
                'view' => ['contracts.index', 'contracts.show', 'properties.tenant-contracts'],
                // Renewing writes the next contract.
                'create' => ['contracts.create', 'contracts.store', 'contracts.renew'],
                'edit' => ['contracts.edit', 'contracts.update', 'contracts.activate'],
                'terminate' => ['contracts.terminate'],
            ],
            'rentals' => [
                'view' => ['rentals.index', 'rentals.show'],
                'create' => ['rentals.create', 'rentals.store'],
                'edit' => ['rentals.edit', 'rentals.update'],
                'end' => ['rentals.end'],
            ],
        ],

        'landlords' => [
            'landlords' => [
                'view' => ['landlords.index', 'landlords.show'],
                'create' => ['landlords.create', 'landlords.store'],
                'edit' => ['landlords.edit', 'landlords.update'],
            ],
            'head_leases' => [
                'view' => ['head-leases.index', 'head-leases.show'],
                'create' => ['head-leases.create', 'head-leases.store'],
                'edit' => ['head-leases.edit', 'head-leases.update'],
            ],
        ],

        'amcs' => [
            'amc_visits' => [
                'view' => ['amc-visits.index', 'amc-visits.report', 'amcs.contract'],
                'manage' => ['amc-visits.store', 'amc-visits.reschedule', 'amc-visits.status', 'amc-visits.destroy'],
            ],
            ...$amcPages,
        ],

        'payments' => [
            'payments_overview' => [
                'view' => ['payments.overview'],
            ],
            'invoices' => [
                'view' => ['invoices.index', 'invoices.show'],
                'create' => ['contracts.invoices.store'],
                'void' => ['invoices.void'],
            ],
            'payments_received' => [
                'view' => ['payments.index', 'payments.show'],
                // Including the quick payment on a property's billing tab.
                'create' => ['payments.create', 'payments.store', 'properties.billing.store'],
                'status' => ['payments.update'],
            ],
            'rent_collections' => [
                'view' => ['rental-payments.index', 'rental-payments.show'],
                'create' => ['rentals.payments.store'],
                'void' => ['rental-payments.void'],
            ],
            'extra_income' => [
                'view' => ['extra-incomes.index', 'extra-incomes.invoice'],
                'create' => ['extra-incomes.create', 'extra-incomes.store'],
                'edit' => ['extra-incomes.edit', 'extra-incomes.update', 'extra-incomes.status'],
            ],
            'cheques' => [
                'view' => ['cheques.index', 'cheques.image', 'landlord-payments.index'],
                'schedule' => ['contracts.cheques.store', 'head-leases.cheques.store', 'amcs.cheques.store'],
                'edit' => ['cheques.update'],
                'status' => ['cheques.status', 'cheques.bulk-status', 'cheques.settle', 'cheques.replace'],
            ],
            'maintenance_bills' => [
                'view' => ['maintenance-bills.index', 'maintenance-bills.voucher'],
                'pay' => ['maintenance-bills.pay', 'maintenance-bills.unpay'],
            ],
            'salaries' => [
                'view' => ['salaries.index'],
            ],
            // Each property's money in and out, and the cash its camp boss hands over.
            'property_payments' => [
                'view' => ['properties.payments'],
                'confirm_cash' => ['properties.cash-handover.store'],
            ],
            // One-off payments such as a permit fee, added from a property's payments page.
            'other_payments' => [
                'view' => ['other-payments.receipt'],
                'create' => ['other-payments.create', 'other-payments.store'],
                'edit' => ['other-payments.edit', 'other-payments.update', 'other-payments.status'],
            ],
        ],

        'staff' => [
            'staff' => [
                'view' => ['staff.index', 'staff.show'],
                'create' => ['staff.create', 'staff.store'],
                'edit' => ['staff.edit', 'staff.update'],
            ],
            'attendance' => [
                'view' => ['attendance.index'],
                'mark' => ['attendance.store'],
            ],
            'payroll' => [
                'view' => ['payroll.index'],
                'manage' => ['payroll.store', 'payroll.pay-all', 'payroll.update', 'payroll.pay', 'payroll.unpay'],
            ],
        ],

        'maintenance' => [
            'maintenance' => [
                'view' => ['maintenance.index', 'maintenance.show', 'maintenance.invoice'],
                'create' => ['maintenance.create', 'maintenance.store'],
                'edit' => ['maintenance.edit', 'maintenance.update', 'maintenance.status'],
            ],
        ],

        'reports' => $reportPages,

        'configuration' => [
            'company_profile' => [
                'view' => ['configuration.company'],
                'edit' => ['configuration.company.update'],
            ],
            // The type lists are shared by every company, so only platform admins change them (see LookupTypeRequest).
            'property_types' => ['view' => ['configuration.property-types', 'configuration.property-types.store', 'configuration.property-types.update', 'configuration.property-types.destroy']],
            'room_types' => ['view' => ['configuration.room-types', 'configuration.room-types.store', 'configuration.room-types.update', 'configuration.room-types.destroy']],
            'maintenance_statuses' => ['view' => ['configuration.maintenance-statuses', 'configuration.maintenance-statuses.store', 'configuration.maintenance-statuses.update', 'configuration.maintenance-statuses.destroy']],
            'maintenance_categories' => ['view' => ['configuration.maintenance-categories', 'configuration.maintenance-categories.store', 'configuration.maintenance-categories.update', 'configuration.maintenance-categories.destroy']],
            'cheque_statuses' => ['view' => ['configuration.cheque-statuses', 'configuration.cheque-statuses.store', 'configuration.cheque-statuses.update', 'configuration.cheque-statuses.destroy']],
            'staff_roles' => ['view' => ['configuration.staff-roles', 'configuration.staff-roles.store', 'configuration.staff-roles.update', 'configuration.staff-roles.destroy']],
            'regional_offices' => [
                'view' => ['configuration.regional-offices'],
                'manage' => ['configuration.regional-offices.store', 'configuration.regional-offices.update', 'configuration.regional-offices.destroy'],
            ],
            'users' => [
                'manage' => ['configuration.users', 'configuration.users.store', 'configuration.users.edit', 'configuration.users.update'],
            ],
        ],
    ],

    /*
    | Pages a company can never lose, so someone can always sign in, see who
    | the company is and give out access.
    */
    'always_on' => ['company_profile', 'users'],

    /*
    | Signed-in routes that need no permission: the dashboard (which decides
    | for itself), each staff member's own page, help and the profile.
    | Platform admin routes are gated on their own.
    */
    'open_routes' => ['dashboard', 'my.*', 'help', 'profile.*', 'admin.*', 'verification.*', 'password.*', 'logout'],

    /*
    | Each role's permissions. "*" matches any part of a name, and a "!"
    | in front takes matches away again.
    */
    'roles' => [
        UserRole::SUPER_ADMIN => ['*'],

        UserRole::OFFICE_ADMIN => ['*'],

        UserRole::AREA_MANAGER => [
            ...$campWork,
            'rooms.create', 'shops.create', 'apartments.create', 'contracts.terminate',
            'cheques.schedule', 'report_receivables.view',
        ],

        UserRole::CAMP_BOSS => $campWork,
    ],

    /*
    | Pages about the whole company rather than its camps, kept from area
    | managers and camp bosses whatever is chosen for them: their figures
    | would reach past the user's camps.
    */
    'company_wide' => [
        'payments_overview', 'report_income', 'report_summary',
        'company_profile', 'property_types', 'room_types', 'maintenance_statuses', 'maintenance_categories', 'cheque_statuses', 'staff_roles',
        'regional_offices', 'users',
    ],

    /*
    | Company accounts without a role (made before roles existed) keep the
    | access they always had: everything but confirming cash handovers and
    | giving out access, which were always the super admin's.
    */
    'without_role' => ['*', '!property_payments.confirm_cash', '!users.*'],

    /*
    | A staff member's sign-in: its access level decides the staff pages, and
    | "uses the rest of the app" adds everything else the role would not.
    */
    'staff_access' => [
        'self' => [],
        'supervisor' => ['staff.view', 'attendance.*', 'payroll.view', 'salaries.view', 'report_staff.view'],
        'admin' => ['staff.*', 'attendance.*', 'payroll.*', 'salaries.view', 'report_staff.view', 'regional_offices.*'],
    ],

    'app_access' => [
        '*',
        '!staff.*', '!attendance.*', '!payroll.*', '!salaries.*', '!report_staff.*', '!regional_offices.manage',
        '!property_payments.confirm_cash', '!users.*',
    ],

];
