<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Company;
use App\Models\Occupant;
use App\Models\RoomRental;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Individuals renting the private room at the Jebel Ali residence without
 * a contract. A past tenant stayed from February to June, paid every month
 * and had her deposit handed back. Today's tenant moved in at the start of
 * July: she paid the deposit and three months' rent, still owes this
 * month's, and has handed over a post-dated cheque for next month.
 *
 * Dates follow today, so the story reads the same whenever it is seeded.
 * Safe to re-run: tenants are matched on their passport. Requires
 * OccupancySeeder.
 */
class RoomRentalSeeder extends Seeder
{
    public const PAST_TENANT = 'Fatima Noor';

    public const TENANT = 'Maria Santos';

    private const ROOM = '102';

    private const RENT = 1500;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $user = $company->users()->orderBy('id')->first();
        $room = $company->properties()->where('code', PropertySeeder::JEBEL_ALI)->firstOrFail()->rooms()->where('room_number', self::ROOM)->firstOrFail();
        $bedId = $room->beds()->where('is_active', true)->orderBy('id')->value('id');
        $thisMonth = CarbonImmutable::today()->startOfMonth();
        $movedIn = $thisMonth->subMonthsNoOverflow(3);

        $past = $this->rental($company, $user, self::PAST_TENANT, 'Pakistani', 'FN7781204', '+971 52 660 4182', [
            'room_id' => $room->id,
            'property_id' => $room->property_id,
            'bed_id' => $bedId,
            'unit_type' => 'bed',
            'start_date' => $thisMonth->subMonthsNoOverflow(8),
            'notes' => 'Nurse at the nearby clinic; moved to staff housing in July.',
        ]);

        if ($past?->wasRecentlyCreated) {
            $this->pay($past, $user, 'deposit', 'cash', $past->start_date->toImmutable(), self::RENT);

            for ($month = 0; $month < 5; $month++) {
                $this->pay($past, $user, 'rent', $month % 2 === 0 ? 'cash' : 'bank_transfer', $past->start_date->toImmutable()->addMonthsNoOverflow($month)->addDay(), self::RENT);
            }

            $past->end($movedIn, self::RENT, 'bank_transfer', 'Room left clean; deposit returned in full.');
        }

        $current = $this->rental($company, $user, self::TENANT, 'Filipino', 'P9031677', '+971 56 218 7740', [
            'room_id' => $room->id,
            'property_id' => $room->property_id,
            'bed_id' => $bedId,
            'unit_type' => 'room',
            'start_date' => $movedIn,
            'notes' => 'Pays at the office at the start of each month.',
        ]);

        if ($current?->wasRecentlyCreated) {
            $this->pay($current, $user, 'deposit', 'bank_transfer', $movedIn, self::RENT);

            foreach (['cash', 'bank_transfer', 'cash'] as $month => $method) {
                $this->pay($current, $user, 'rent', $method, $movedIn->addMonthsNoOverflow($month)->addDays(2), self::RENT);
            }

            $cheque = $current->receiveCheque([
                'purpose' => 'rent',
                'cheque_date' => $thisMonth->addMonthNoOverflow(),
                'amount' => self::RENT,
                'cheque_number' => '318842',
                'bank_name' => 'Emirates NBD',
                'account_holder' => self::TENANT,
                'notes' => 'Post-dated for next month’s rent.',
            ], $user);
            ChequeSeeder::attachDemoPhoto($cheque);
        }
    }

    /**
     * The tenant's rental, created and checked in the first time, or null
     * when it already exists.
     *
     * @param  array<string, mixed>  $place
     */
    private function rental(Company $company, ?User $user, string $name, string $nationality, string $passport, string $phone, array $place): ?RoomRental
    {
        $client = $company->clients()->where('id_type', 'passport')->where('id_number', $passport)->first();

        if ($client && $client->roomRentals()->exists()) {
            return null;
        }

        $client ??= (new Client([
            'client_type' => 'individual',
            'name' => $name,
            'contact_person_name' => $name,
            'phone' => $phone,
            'email' => strtolower(str_replace(' ', '.', $name)).'@example.test',
            'id_type' => 'passport',
            'id_number' => $passport,
            'nationality' => $nationality,
            'address' => 'Jebel Ali Staff Residence, Dubai',
            'status' => 'active',
            'notes' => 'Rents a room directly, without a contract.',
        ]))->forceFill(['company_id' => $company->id]);
        $client->save();

        $occupant = (new Occupant([
            'client_id' => $client->id,
            'full_name' => $name,
            'gender' => 'female',
            'nationality' => $nationality,
            'id_type' => 'passport',
            'id_number' => $passport,
            'phone' => $phone,
        ]))->forceFill(['company_id' => $company->id]);
        $occupant->save();

        $rental = new RoomRental(['monthly_rent' => self::RENT, 'security_deposit' => self::RENT, 'start_date' => $place['start_date'], 'notes' => $place['notes']]);
        $rental->forceFill([
            ...array_diff_key($place, array_flip(['start_date', 'notes'])),
            'company_id' => $company->id,
            'rental_number' => RoomRental::nextNumber($company->id, $place['start_date']),
            'client_id' => $client->id,
            'occupant_id' => $occupant->id,
            'status' => 'active',
            'created_by' => $user?->id,
        ])->save();
        $rental->checkIn();

        return $rental;
    }

    private function pay(RoomRental $rental, ?User $user, string $purpose, string $method, CarbonImmutable $on, float $amount): void
    {
        $rental->recordPayment([
            'paid_on' => $on->min(CarbonImmutable::today()),
            'amount' => $amount,
            'purpose' => $purpose,
            'method' => $method,
            'reference' => $method === 'bank_transfer' ? 'TRF-'.$on->format('ymd').'-'.$rental->id : null,
        ], $user);
    }
}
