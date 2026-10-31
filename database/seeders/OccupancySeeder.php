<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\Room;
use Illuminate\Database\Seeder;

/**
 * The people staying in the demo rooms, checked into the rooms the
 * contract lines rent. Each room's occupancy is then recalculated. One
 * past stay (a worker who left in June) shows history.
 *
 * Safe to re-run: occupants are matched on their passport and stays on
 * their check-in date. Requires ContractSeeder.
 */
class OccupancySeeder extends Seeder
{
    /**
     * Contracts by number, and rooms by "property code/room number".
     *
     * @var array<string, mixed>
     */
    private array $cache = [];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();

        foreach ($this->stays() as $stay) {
            $this->saveStay($company, $stay);
        }

        $company->rooms()->get()->each(fn (Room $room) => $room->recalculateOccupancy());
    }

    /**
     * @param  array<string, mixed>  $stay
     */
    private function saveStay(Company $company, array $stay): void
    {
        $contract = $this->cache["contract/{$stay['contract']}"] ??= $company->contracts()
            ->where('contract_number', $stay['contract'])
            ->with('lines')
            ->firstOrFail();
        $room = $this->cache["room/{$stay['property']}/{$stay['room']}"] ??= $company->properties()
            ->where('code', $stay['property'])
            ->firstOrFail()
            ->rooms()
            ->where('room_number', $stay['room'])
            ->firstOrFail();

        $occupant = $company->occupants()->updateOrCreate(
            ['id_type' => 'passport', 'id_number' => $stay['passport']],
            [
                'client_id' => $contract->client_id,
                'full_name' => $stay['name'],
                'gender' => $stay['gender'] ?? 'male',
                'nationality' => $stay['nationality'],
                'phone' => $stay['phone'],
                'employee_number' => $stay['employee'] ?? null,
                'notes' => $stay['notes'] ?? null,
            ],
        );

        // Matched with whereDate: SQLite stores the date with a time, so a plain comparison never matches.
        $occupant->occupancies()
            ->whereDate('check_in_date', $stay['in'])
            ->firstOrNew()
            ->forceFill([
                'company_id' => $company->id,
                'contract_line_id' => $contract->lines->firstOrFail('room_id', $room->id)->id,
                'room_id' => $room->id,
                'check_in_date' => $stay['in'],
                'check_out_date' => $stay['out'] ?? null,
            ])
            ->save();
    }

    /**
     * One entry per stay; a group of workers moves into a room together.
     *
     * @return list<array<string, mixed>>
     */
    private function stays(): array
    {
        $aq = PropertySeeder::AL_QUOZ;
        $ja = PropertySeeder::JEBEL_ALI;

        return [
            ...$this->crew('CTR-2026-0001', $aq, '101', '2026-01-05', 'GB', 1001, [
                ['Mohammed Rafiq', 'Bangladeshi', 'BD4410271'],
                ['Suresh Kumar', 'Indian', 'N2873301'],
                ['Arjun Thapa', 'Nepali', 'NP1093382'],
                ['Imran Ali', 'Pakistani', 'PK7739104'],
                ['Rajesh Pillai', 'Indian', 'N3190287'],
                ['Bikash Gurung', 'Nepali', 'NP2284510'],
                ['Abdul Karim', 'Bangladeshi', 'BD5520916'],
            ]),
            [
                'contract' => 'CTR-2026-0001', 'property' => $aq, 'room' => '101',
                'name' => 'Santosh Rai', 'nationality' => 'Nepali', 'passport' => 'NP3391047', 'phone' => '+971 52 300 1108',
                'employee' => 'GB-1008', 'in' => '2026-01-05', 'out' => '2026-06-30',
                'notes' => 'Finished his contract with Gulf Builders and flew home in June.',
            ],
            ...$this->crew('CTR-2026-0001', $aq, '102', '2026-02-10', 'GB', 1009, [
                ['Faisal Mahmood', 'Pakistani', 'PK8840215'],
                ['Vinod Nair', 'Indian', 'N4402918'],
                ['Rohan Shrestha', 'Nepali', 'NP4410983'],
                ['Jahangir Alam', 'Bangladeshi', 'BD6631027'],
                ['Manoj Yadav', 'Indian', 'N5513029'],
                ['Tariq Hussain', 'Pakistani', 'PK9951326'],
                ['Dipak Tamang', 'Nepali', 'NP5521094'],
                ['Shafiqul Islam', 'Bangladeshi', 'BD7742138'],
            ]),
            ...$this->crew('CTR-2026-0002', $aq, '103', '2026-03-01', 'AN', 2001, [
                ['Joseph Varghese', 'Indian', 'N6624130'],
                ['Anil Joshi', 'Indian', 'N7735241'],
                ['Ramon Cruz', 'Filipino', 'P2846352A'],
            ]),
            ...$this->crew('CTR-2026-0002', $aq, '201', '2026-03-01', 'AN', 2004, [
                ['Nadeem Akhtar', 'Pakistani', 'PK1062437'],
                ['Prakash Sharma', 'Nepali', 'NP6632105'],
                ['Mark Dela Cruz', 'Filipino', 'P3957463B'],
            ]),
            [
                'contract' => 'CTR-2026-0002', 'property' => $aq, 'room' => '201',
                'name' => 'Sunil Perera', 'nationality' => 'Sri Lankan', 'passport' => 'SL8473021', 'phone' => '+971 52 300 2007',
                'employee' => 'AN-2007', 'in' => '2026-05-03',
                'notes' => 'Joined the other supervisors in room 201 in May.',
            ],
            ...$this->crew('CTR-2026-0003', $ja, '103', '2026-02-01', 'DL', 3001, [
                ['Grace Mendoza', 'Filipino', 'P4068574C', 'female'],
                ['Priya Nair', 'Indian', 'N8846352', 'female'],
            ]),
            ...$this->crew('CTR-2026-0003', $ja, '201', '2026-02-01', 'DL', 3003, [
                ['Kevin Fernandes', 'Indian', 'N9957463'],
            ]),
            [
                'contract' => 'CTR-2026-0004', 'property' => $ja, 'room' => '101',
                'name' => ClientSeeder::RAHUL, 'nationality' => 'Indian', 'passport' => 'P4821937', 'phone' => '+971 50 334 2190', 'in' => '2026-06-01',
            ],
            [
                'contract' => 'CTR-2026-0005', 'property' => $ja, 'room' => '202',
                'name' => ClientSeeder::DANIEL, 'nationality' => 'Nigerian', 'passport' => 'A07264519', 'phone' => '+971 54 771 0832', 'in' => '2026-04-15',
            ],
        ];
    }

    /**
     * Stays for a group checking into one room on the same day.
     *
     * @param  list<array{0: string, 1: string, 2: string, 3?: string}>  $people  Name, nationality, passport and optional gender.
     * @return list<array<string, mixed>>
     */
    private function crew(string $contract, string $property, string $room, string $checkIn, string $employer, int $firstEmployeeNumber, array $people): array
    {
        return array_map(fn (array $person, int $index) => [
            'contract' => $contract,
            'property' => $property,
            'room' => $room,
            'name' => $person[0],
            'nationality' => $person[1],
            'passport' => $person[2],
            'gender' => $person[3] ?? 'male',
            'phone' => sprintf('+971 52 %03d %04d', $firstEmployeeNumber % 1000, 1000 + $index),
            'employee' => sprintf('%s-%d', $employer, $firstEmployeeNumber + $index),
            'in' => $checkIn,
        ], $people, array_keys($people));
    }
}
