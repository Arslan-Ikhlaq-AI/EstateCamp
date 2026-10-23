<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'name',
    'legal_name',
    'short_name',
    'trade_license_number',
    'tax_registration_number',
    'email',
    'phone',
    'default_currency',
    'timezone',
    'status',
    'description',
    'logo_url',
    'website',
    'contact_person_name',
    'contact_person_phone',
    'contact_person_email',
    'address_line_1',
    'address_line_2',
    'city',
    'state',
    'postal_code',
    'country_code',
    'expiry_date',
])]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expiry_date' => 'date',
        ];
    }

    /**
     * The date and time where the company works, in its own time zone, so a
     * day's attendance starts at the company's midnight rather than the server's.
     */
    public function localNow(): CarbonImmutable
    {
        return CarbonImmutable::now($this->timezone ?: config('app.timezone'));
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * @return HasMany<Property, $this>
     */
    public function properties(): HasMany
    {
        return $this->hasMany(Property::class);
    }

    /**
     * @return HasMany<Room, $this>
     */
    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    /**
     * @return HasMany<Apartment, $this>
     */
    public function apartments(): HasMany
    {
        return $this->hasMany(Apartment::class);
    }

    /**
     * @return HasMany<Shop, $this>
     */
    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class);
    }

    /**
     * @return HasMany<Landlord, $this>
     */
    public function landlords(): HasMany
    {
        return $this->hasMany(Landlord::class);
    }

    /**
     * @return HasMany<HeadLease, $this>
     */
    public function headLeases(): HasMany
    {
        return $this->hasMany(HeadLease::class);
    }

    /**
     * Every cheque the company receives or issues.
     *
     * @return HasMany<Cheque, $this>
     */
    public function cheques(): HasMany
    {
        return $this->hasMany(Cheque::class);
    }

    /**
     * Every problem reported at the company's properties.
     *
     * @return HasMany<MaintenanceJob, $this>
     */
    public function maintenanceJobs(): HasMany
    {
        return $this->hasMany(MaintenanceJob::class);
    }

    /**
     * Everyone the company employs or has employed.
     *
     * @return HasMany<StaffMember, $this>
     */
    public function staffMembers(): HasMany
    {
        return $this->hasMany(StaffMember::class);
    }

    /**
     * The company's regional sub-offices.
     *
     * @return HasMany<RegionalOffice, $this>
     */
    public function regionalOffices(): HasMany
    {
        return $this->hasMany(RegionalOffice::class);
    }

    /**
     * @return HasMany<StaffAttendance, $this>
     */
    public function staffAttendances(): HasMany
    {
        return $this->hasMany(StaffAttendance::class);
    }

    /**
     * Every staff salary the payroll has worked out, paid or not.
     *
     * @return HasMany<SalaryPayment, $this>
     */
    public function salaryPayments(): HasMany
    {
        return $this->hasMany(SalaryPayment::class);
    }

    /**
     * @return HasMany<Client, $this>
     */
    public function clients(): HasMany
    {
        return $this->hasMany(Client::class);
    }

    /**
     * @return HasMany<Contract, $this>
     */
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    /**
     * @return HasMany<Occupant, $this>
     */
    public function occupants(): HasMany
    {
        return $this->hasMany(Occupant::class);
    }

    /**
     * @return HasMany<Occupancy, $this>
     */
    public function occupancies(): HasMany
    {
        return $this->hasMany(Occupancy::class);
    }

    /**
     * Beds and rooms rented to individuals without a contract.
     *
     * @return HasMany<RoomRental, $this>
     */
    public function roomRentals(): HasMany
    {
        return $this->hasMany(RoomRental::class);
    }

    /**
     * Receipts for what individuals paid towards their room rentals.
     *
     * @return HasMany<RentalPayment, $this>
     */
    public function rentalPayments(): HasMany
    {
        return $this->hasMany(RentalPayment::class);
    }

    /**
     * @return HasMany<Invoice, $this>
     */
    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
