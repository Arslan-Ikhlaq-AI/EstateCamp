<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Company;
use App\Models\Room;
use App\Models\RoomRental;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Companies renting the private room at the Jebel Ali residence short-term,
 * without a contract. A past tenant took it for six months from February,
 * paid every month, left after five and had its deposit handed back.
 * Today's tenant took it for six months from the start of July: it paid the
 * deposit and three months' rent, still owes this month's, and has handed
 * over a post-dated cheque for next month.
 *
 * Dates follow today, so the story reads the same whenever it is seeded.
 * Safe to re-run: tenants are matched on their name. Requires RoomSeeder.
 */
class RoomRentalSeeder extends Seeder
{
    public const PAST_TENANT = 'Coastline Marine Services L.L.C.';

    public const TENANT = 'BrightPath Events L.L.C.';

    private const ROOM = '102';

    private const RENT = 1500;

    private const TERM_MONTHS = 6;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $user = $company->users()->orderBy('id')->first();
        $room = $company->properties()->where('code', PropertySeeder::JEBEL_ALI)->firstOrFail()->rooms()->where('room_number', self::ROOM)->firstOrFail();
        $thisMonth = CarbonImmutable::today()->startOfMonth();
        $movedIn = $thisMonth->subMonthsNoOverflow(3);

        $past = $this->rental($company, $user, $room, self::PAST_TENANT, 'Hassan Ali', '+971 4 881 2290', $thisMonth->subMonthsNoOverflow(8), 'Boat crew between charters; left a month early.');

        if ($past?->wasRecentlyCreated) {
            $this->pay($past, $user, 'deposit', 'cash', $past->start_date->toImmutable(), self::RENT);

            for ($month = 0; $month < 5; $month++) {
                $this->pay($past, $user, 'rent', $month % 2 === 0 ? 'cash' : 'bank_transfer', $past->start_date->toImmutable()->addMonthsNoOverflow($month)->addDay(), self::RENT);
            }

            $past->end($movedIn, self::RENT, 'bank_transfer', 'Room left clean; deposit returned in full.');
        }

        $current = $this->rental($company, $user, $room, self::TENANT, 'Leila Haddad', '+971 56 218 7740', $movedIn, 'Event staff for the winter season. Pays at the office at the start of each month.');

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
     * The company's rental of the room, created the first time, or null
     * when it already exists.
     */
    private function rental(Company $company, ?User $user, Room $room, string $name, string $contact, string $phone, CarbonImmutable $start, string $notes): ?RoomRental
    {
        $client = $company->clients()->where('name', $name)->first();

        if ($client && $client->roomRentals()->exists()) {
            return null;
        }

        $client ??= (new Client([
            'client_type' => 'company',
            'name' => $name,
            'contact_person_name' => $contact,
            'phone' => $phone,
            'status' => 'active',
            'notes' => 'Rents rooms short-term, without a contract.',
        ]))->forceFill(['company_id' => $company->id]);
        $client->save();

        $rental = new RoomRental([
            'monthly_rent' => self::RENT,
            'security_deposit' => self::RENT,
            'start_date' => $start,
            'end_date' => RoomRental::endDateFor($start, self::TERM_MONTHS),
            'notes' => $notes,
        ]);
        $rental->forceFill([
            'company_id' => $company->id,
            'rental_number' => RoomRental::nextNumber($company->id, $start),
            'client_id' => $client->id,
            'property_id' => $room->property_id,
            'status' => 'active',
            'created_by' => $user?->id,
        ])->save();
        $rental->rooms()->attach($room->id, ['company_id' => $company->id]);

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
