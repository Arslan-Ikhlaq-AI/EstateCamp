<?php

use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\ApartmentController;
use App\Http\Controllers\ChequeController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\CompanyProfileController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HeadLeaseController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\LandlordController;
use App\Http\Controllers\MaintenanceBillController;
use App\Http\Controllers\MaintenanceCategoryController;
use App\Http\Controllers\MaintenanceJobController;
use App\Http\Controllers\MaintenanceStatusController;
use App\Http\Controllers\OccupancyController;
use App\Http\Controllers\OccupantController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PaymentOverviewController;
use App\Http\Controllers\PayrollController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PropertyController;
use App\Http\Controllers\PropertyTypeController;
use App\Http\Controllers\RegionalOfficeController;
use App\Http\Controllers\RentalPaymentController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomRentalController;
use App\Http\Controllers\RoomTypeController;
use App\Http\Controllers\SalaryPaymentController;
use App\Http\Controllers\ShopController;
use App\Http\Controllers\StaffAttendanceController;
use App\Http\Controllers\StaffMemberController;
use App\Http\Controllers\StaffPortalController;
use App\Http\Controllers\StaffRoleController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function (Request $request) {
    return redirect()->route($request->user() ? 'dashboard' : 'login');
});

Route::middleware(['auth', 'verified'])->group(function () {
    // Staff whose sign-in covers only the staff pages are sent on from here to their own.
    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    // Each staff member's own attendance and pay.
    Route::get('my', [StaffPortalController::class, 'index'])->name('my.index');
    Route::post('my/check-in', [StaffPortalController::class, 'checkIn'])->name('my.check-in');
    Route::post('my/check-out', [StaffPortalController::class, 'checkOut'])->name('my.check-out');

    // Staff: everyone the company employs, their daily attendance and their monthly
    // salaries. Supervisors see them and mark attendance; staff admins change them.
    Route::middleware('can:view-staff')->group(function () {
        Route::resource('staff', StaffMemberController::class)->only(['index', 'show'])->parameters(['staff' => 'staffMember'])->whereNumber('staffMember');
        Route::get('attendance', [StaffAttendanceController::class, 'index'])->name('attendance.index');
        Route::post('attendance', [StaffAttendanceController::class, 'store'])->name('attendance.store');
        Route::get('payroll', [PayrollController::class, 'index'])->name('payroll.index');
        // Salaries across months, as payments, for the payments section.
        Route::get('salaries', [SalaryPaymentController::class, 'index'])->name('salaries.index');
    });

    Route::middleware('can:manage-staff')->group(function () {
        Route::resource('staff', StaffMemberController::class)->only(['create', 'store', 'edit', 'update'])->parameters(['staff' => 'staffMember'])->whereNumber('staffMember');
        Route::post('payroll', [PayrollController::class, 'store'])->name('payroll.store');
        Route::post('payroll/pay', [PayrollController::class, 'payAll'])->name('payroll.pay-all');
        Route::put('payroll/{salaryPayment}', [PayrollController::class, 'update'])->whereNumber('salaryPayment')->name('payroll.update');
        Route::post('payroll/{salaryPayment}/pay', [PayrollController::class, 'pay'])->whereNumber('salaryPayment')->name('payroll.pay');
        Route::post('payroll/{salaryPayment}/unpay', [PayrollController::class, 'unpay'])->whereNumber('salaryPayment')->name('payroll.unpay');
        Route::post('configuration/regional-offices', [RegionalOfficeController::class, 'store'])->name('configuration.regional-offices.store');
        Route::put('configuration/regional-offices/{regionalOffice}', [RegionalOfficeController::class, 'update'])->name('configuration.regional-offices.update');
        Route::delete('configuration/regional-offices/{regionalOffice}', [RegionalOfficeController::class, 'destroy'])->name('configuration.regional-offices.destroy');
    });

    // The rest of the app, for everyone but staff whose sign-in covers only the staff pages.
    Route::middleware('can:use-app')->group(function () {
        Route::resource('properties', PropertyController::class)->except(['destroy'])->whereNumber('property');
        Route::resource('rooms', RoomController::class)->except(['show', 'destroy']);
        Route::resource('apartments', ApartmentController::class)->except(['destroy']);
        Route::resource('shops', ShopController::class)->except(['destroy']);

        // Leasing: what the company rents from landlords, and what clients rent from it.
        Route::resource('landlords', LandlordController::class)->except(['destroy']);
        Route::resource('head-leases', HeadLeaseController::class)->except(['destroy']);
        Route::post('head-leases/{head_lease}/cheques', [ChequeController::class, 'scheduleLease'])->name('head-leases.cheques.store');
        // Landlord instalments became issued cheques; the old address opens them in the cheque register.
        Route::redirect('landlord-payments', '/cheques?direction[]=issued')->name('landlord-payments.index');
        Route::resource('clients', ClientController::class)->except(['destroy']);
        Route::resource('contracts', ContractController::class)->except(['destroy']);
        Route::post('contracts/{contract}/activate', [ContractController::class, 'activate'])->name('contracts.activate');
        Route::post('contracts/{contract}/terminate', [ContractController::class, 'terminate'])->name('contracts.terminate');
        Route::post('contracts/{contract}/renew', [ContractController::class, 'renew'])->name('contracts.renew');
        Route::post('contracts/{contract}/invoices', [InvoiceController::class, 'store'])->name('contracts.invoices.store');
        Route::post('contracts/{contract}/cheques', [ChequeController::class, 'scheduleContract'])->name('contracts.cheques.store');
        Route::resource('occupants', OccupantController::class)->except(['destroy']);
        Route::get('check-in', [OccupancyController::class, 'create'])->name('occupancies.create');
        Route::post('occupancies', [OccupancyController::class, 'store'])->name('occupancies.store');
        Route::patch('occupancies/{occupancy}/check-out', [OccupancyController::class, 'update'])->name('occupancies.check-out');
        Route::get('invoices', [InvoiceController::class, 'index'])->name('invoices.index');
        Route::get('invoices/{invoice}', [InvoiceController::class, 'show'])->name('invoices.show');
        Route::post('invoices/{invoice}/void', [InvoiceController::class, 'void'])->name('invoices.void');
        // Payments: every movement of money in one overview, then each kind on its own page.
        Route::get('payments/overview', PaymentOverviewController::class)->name('payments.overview');
        Route::resource('payments', PaymentController::class)->only(['index', 'create', 'store', 'show', 'update'])->whereNumber('payment');

        // Individual rentals: beds and rooms rented to individuals without a contract, and their receipts.
        Route::resource('rentals', RoomRentalController::class)->except(['destroy'])->parameters(['rentals' => 'roomRental'])->whereNumber('roomRental');
        Route::post('rentals/{roomRental}/end', [RoomRentalController::class, 'end'])->whereNumber('roomRental')->name('rentals.end');
        Route::post('rentals/{roomRental}/payments', [RentalPaymentController::class, 'store'])->whereNumber('roomRental')->name('rentals.payments.store');
        Route::get('rental-payments', [RentalPaymentController::class, 'index'])->name('rental-payments.index');
        Route::get('rental-payments/{rentalPayment}', [RentalPaymentController::class, 'show'])->whereNumber('rentalPayment')->name('rental-payments.show');
        Route::post('rental-payments/{rentalPayment}/void', [RentalPaymentController::class, 'void'])->whereNumber('rentalPayment')->name('rental-payments.void');

        // Maintenance bills: paying vendors for finished work, with a voucher for each payment.
        Route::get('maintenance-bills', [MaintenanceBillController::class, 'index'])->name('maintenance-bills.index');
        Route::post('maintenance-bills/{maintenanceJob}/pay', [MaintenanceBillController::class, 'pay'])->whereNumber('maintenanceJob')->name('maintenance-bills.pay');
        Route::post('maintenance-bills/{maintenanceJob}/unpay', [MaintenanceBillController::class, 'unpay'])->whereNumber('maintenanceJob')->name('maintenance-bills.unpay');
        Route::get('maintenance-bills/{maintenanceJob}/voucher', [MaintenanceBillController::class, 'voucher'])->whereNumber('maintenanceJob')->name('maintenance-bills.voucher');

        // Cheques: the main record of money moving under contracts and head leases.
        Route::get('cheques', [ChequeController::class, 'index'])->name('cheques.index');
        Route::put('cheques/{cheque}', [ChequeController::class, 'update'])->name('cheques.update');
        Route::post('cheques/{cheque}/transition', [ChequeController::class, 'transition'])->name('cheques.transition');
        Route::post('cheques/{cheque}/replace', [ChequeController::class, 'replace'])->name('cheques.replace');
        Route::get('cheques/{cheque}/images/{side}', [ChequeController::class, 'image'])->whereIn('side', ['front', 'back'])->name('cheques.image');

        // Maintenance: problems at the properties, tracked to completion with what each one cost.
        Route::resource('maintenance', MaintenanceJobController::class)->except(['destroy'])->parameters(['maintenance' => 'maintenanceJob']);
        Route::post('maintenance/{maintenanceJob}/status', [MaintenanceJobController::class, 'changeStatus'])->name('maintenance.status');
        Route::get('maintenance/{maintenanceJob}/invoice', [MaintenanceJobController::class, 'invoice'])->name('maintenance.invoice');

        Route::get('configuration/company', [CompanyProfileController::class, 'edit'])->name('configuration.company');
        Route::put('configuration/company', [CompanyProfileController::class, 'update'])->name('configuration.company.update');
        Route::get('configuration/property-types', [PropertyTypeController::class, 'index'])->name('configuration.property-types');
        Route::post('configuration/property-types', [PropertyTypeController::class, 'store'])->name('configuration.property-types.store');
        Route::put('configuration/property-types/{propertyType}', [PropertyTypeController::class, 'updateType'])->name('configuration.property-types.update');
        Route::delete('configuration/property-types/{propertyType}', [PropertyTypeController::class, 'destroyType'])->name('configuration.property-types.destroy');
        Route::get('configuration/room-types', [RoomTypeController::class, 'index'])->name('configuration.room-types');
        Route::post('configuration/room-types', [RoomTypeController::class, 'store'])->name('configuration.room-types.store');
        Route::put('configuration/room-types/{roomType}', [RoomTypeController::class, 'updateType'])->name('configuration.room-types.update');
        Route::delete('configuration/room-types/{roomType}', [RoomTypeController::class, 'destroyType'])->name('configuration.room-types.destroy');
        Route::get('configuration/maintenance-statuses', [MaintenanceStatusController::class, 'index'])->name('configuration.maintenance-statuses');
        Route::post('configuration/maintenance-statuses', [MaintenanceStatusController::class, 'store'])->name('configuration.maintenance-statuses.store');
        Route::put('configuration/maintenance-statuses/{maintenanceStatus}', [MaintenanceStatusController::class, 'updateType'])->name('configuration.maintenance-statuses.update');
        Route::delete('configuration/maintenance-statuses/{maintenanceStatus}', [MaintenanceStatusController::class, 'destroyType'])->name('configuration.maintenance-statuses.destroy');
        Route::get('configuration/maintenance-categories', [MaintenanceCategoryController::class, 'index'])->name('configuration.maintenance-categories');
        Route::post('configuration/maintenance-categories', [MaintenanceCategoryController::class, 'store'])->name('configuration.maintenance-categories.store');
        Route::put('configuration/maintenance-categories/{maintenanceCategory}', [MaintenanceCategoryController::class, 'updateType'])->name('configuration.maintenance-categories.update');
        Route::delete('configuration/maintenance-categories/{maintenanceCategory}', [MaintenanceCategoryController::class, 'destroyType'])->name('configuration.maintenance-categories.destroy');
        Route::get('configuration/staff-roles', [StaffRoleController::class, 'index'])->name('configuration.staff-roles');
        Route::post('configuration/staff-roles', [StaffRoleController::class, 'store'])->name('configuration.staff-roles.store');
        Route::put('configuration/staff-roles/{staffRole}', [StaffRoleController::class, 'updateType'])->name('configuration.staff-roles.update');
        Route::delete('configuration/staff-roles/{staffRole}', [StaffRoleController::class, 'destroyType'])->name('configuration.staff-roles.destroy');
        Route::get('configuration/regional-offices', [RegionalOfficeController::class, 'index'])->name('configuration.regional-offices');

        /*
         * Sections from the sidebar that are not built yet. Each renders a
         * "coming soon" page; swap a line for the real controller once the
         * module exists, keeping the route name so links keep working.
         */
        $comingSoon = [
            'amcs/fire-safety' => 'amcs.fire-safety',
            'amcs/lifts' => 'amcs.lifts',
            'amcs/garbage' => 'amcs.garbage',
            'amcs/grease-traps' => 'amcs.grease-traps',
            'amcs/drainage' => 'amcs.drainage',
            'amcs/pest-control' => 'amcs.pest-control',
            'amcs/air-conditioning' => 'amcs.air-conditioning',
            'amcs/water-tanks' => 'amcs.water-tanks',
        ];

        foreach ($comingSoon as $uri => $name) {
            Route::inertia($uri, 'ComingSoon', ['section' => $name])->name($name);
        }
    });

    Route::inertia('help', 'ComingSoon', ['section' => 'help'])->name('help');
});

Route::get('/admin', AdminDashboardController::class)
    ->middleware(['auth', 'verified', 'can:view-admin-dashboard'])
    ->name('admin.dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
