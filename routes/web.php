<?php

use App\Http\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\ApartmentController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\CompanyProfileController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\HeadLeaseController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\LandlordController;
use App\Http\Controllers\LandlordPaymentController;
use App\Http\Controllers\OccupancyController;
use App\Http\Controllers\OccupantController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PropertyController;
use App\Http\Controllers\PropertyTypeController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\RoomTypeController;
use App\Http\Controllers\ShopController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function (Request $request) {
    return redirect()->route($request->user() ? 'dashboard' : 'login');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::resource('properties', PropertyController::class)->except(['destroy'])->whereNumber('property');
    Route::resource('rooms', RoomController::class)->except(['show', 'destroy']);
    Route::resource('apartments', ApartmentController::class)->except(['destroy']);
    Route::resource('shops', ShopController::class)->except(['destroy']);

    // Leasing: what the company rents from landlords, and what clients rent from it.
    Route::resource('landlords', LandlordController::class)->except(['destroy']);
    Route::resource('head-leases', HeadLeaseController::class)->except(['destroy']);
    Route::get('landlord-payments', [LandlordPaymentController::class, 'index'])->name('landlord-payments.index');
    Route::patch('landlord-payments/{head_lease_payment}', [LandlordPaymentController::class, 'update'])->name('landlord-payments.update');
    Route::resource('clients', ClientController::class)->except(['destroy']);
    Route::resource('contracts', ContractController::class)->except(['destroy']);
    Route::post('contracts/{contract}/activate', [ContractController::class, 'activate'])->name('contracts.activate');
    Route::post('contracts/{contract}/terminate', [ContractController::class, 'terminate'])->name('contracts.terminate');
    Route::post('contracts/{contract}/renew', [ContractController::class, 'renew'])->name('contracts.renew');
    Route::post('contracts/{contract}/invoices', [InvoiceController::class, 'store'])->name('contracts.invoices.store');
    Route::resource('occupants', OccupantController::class)->except(['destroy']);
    Route::get('check-in', [OccupancyController::class, 'create'])->name('occupancies.create');
    Route::post('occupancies', [OccupancyController::class, 'store'])->name('occupancies.store');
    Route::patch('occupancies/{occupancy}/check-out', [OccupancyController::class, 'update'])->name('occupancies.check-out');
    Route::get('invoices', [InvoiceController::class, 'index'])->name('invoices.index');
    Route::get('invoices/{invoice}', [InvoiceController::class, 'show'])->name('invoices.show');
    Route::post('invoices/{invoice}/void', [InvoiceController::class, 'void'])->name('invoices.void');
    Route::resource('payments', PaymentController::class)->only(['index', 'create', 'store', 'show', 'update']);

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

    /*
     * Sections from the sidebar that are not built yet. Each renders a
     * "coming soon" page; swap a line for the real controller once the
     * module exists, keeping the route name so links keep working.
     */
    $comingSoon = [
        'maintenance' => 'maintenance.index',
        'amcs/fire-safety' => 'amcs.fire-safety',
        'amcs/lifts' => 'amcs.lifts',
        'amcs/garbage' => 'amcs.garbage',
        'amcs/grease-traps' => 'amcs.grease-traps',
        'amcs/drainage' => 'amcs.drainage',
        'amcs/pest-control' => 'amcs.pest-control',
        'amcs/air-conditioning' => 'amcs.air-conditioning',
        'amcs/water-tanks' => 'amcs.water-tanks',
        'help' => 'help',
    ];

    foreach ($comingSoon as $uri => $name) {
        Route::inertia($uri, 'ComingSoon', ['section' => $name])->name($name);
    }
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
