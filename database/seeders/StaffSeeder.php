<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\RegionalOffice;
use App\Models\SalaryPayment;
use App\Models\StaffAttendance;
use App\Models\StaffMember;
use App\Models\StaffRole;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

/**
 * The demo company's people: the head office team, two regional offices
 * with their managers, and the staff of each camp. Attendance is marked
 * from the start of last month (today only at the camps, so the head
 * office still has today's sheet to fill in); last month's payroll is paid
 * and this month's is prepared. One person is on leave, one has left, one
 * joined this month, and a few documents are about to run out. Three of
 * them can sign in, one at each level of access (see SIGN_INS), with the
 * demo password.
 *
 * Safe to re-run: offices and staff are matched on their names, attendance
 * on the day. Requires PortfolioSeeder.
 */
class StaffSeeder extends Seeder
{
    private const BANKS = ['Emirates NBD', 'Abu Dhabi Commercial Bank', 'Mashreq', 'First Abu Dhabi Bank'];

    /**
     * The demo staff who can sign in, with the email they use, each with
     * their role's access: the head of HR (staff admin), the Al Quoz camp's
     * boss (supervisor) and one of its cleaners (their own attendance and pay).
     */
    public const SIGN_INS = [
        'Maria Santos' => 'maria.santos@horizonfm.test',
        'Joseph Mathew' => 'joseph.mathew@horizonfm.test',
        'Hari Prasad Adhikari' => 'hari.adhikari@horizonfm.test',
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $company = CompanySeeder::demoCompany();
        $user = $company->users()->orderBy('id')->first();
        $offices = $this->offices($company);
        $roleIds = StaffRole::query()->pluck('id', 'slug');
        $propertyIds = $company->properties()->pluck('id', 'code');

        foreach ($this->staff() as $row) {
            if ($company->staffMembers()->where('full_name', $row['name'])->exists()) {
                continue;
            }

            $member = new StaffMember([...$this->defaults($row), ...($row['set'] ?? [])]);
            $member->staff_role_id = $roleIds->get($row['role']);
            $member->placeAt(
                match (true) {
                    $row['at'] === 'hq' => 'head_office',
                    $offices->has($row['at']) => 'regional',
                    default => 'site',
                },
                $offices->get($row['at'])?->id,
                $propertyIds->get($row['at']),
            );
            $member->forceFill([
                'company_id' => $company->id,
                'employee_number' => StaffMember::nextNumber($company->id, $member->joined_on),
                'created_by' => $user?->id,
            ])->save();
        }

        $this->giveSignIns($company);
        $this->markAttendance($company, $user);
        $this->preparePayroll($company, $user);
    }

    /**
     * Give the demo staff in SIGN_INS their sign-in, unless they have one.
     */
    private function giveSignIns(Company $company): void
    {
        foreach (self::SIGN_INS as $name => $email) {
            $member = $company->staffMembers()->where('full_name', $name)->with('role')->firstOrFail();

            if ($member->user_id === null) {
                $member->forceFill(['email' => $email]);
                $member->syncSignIn(true, $member->role->staff_access, $member->role->app_access, UserSeeder::DEMO_PASSWORD);
            }
        }
    }

    /**
     * The regional offices, by name.
     *
     * @return Collection<string, RegionalOffice>
     */
    private function offices(Company $company): Collection
    {
        return collect([
            ['name' => 'Dubai Region', 'code' => 'DXB', 'city' => 'Dubai', 'address' => 'Office 1204, Al Quoz Business Centre', 'phone' => '+971 4 321 8800'],
            ['name' => 'Northern Emirates Region', 'code' => 'NER', 'city' => 'Sharjah', 'address' => 'Al Taawun Street, Al Khan', 'phone' => '+971 6 544 2100'],
        ])->mapWithKeys(fn (array $office) => [
            $office['name'] => $company->regionalOffices()->firstOrCreate(['name' => $office['name']], $office),
        ]);
    }

    /**
     * The details every demo staff member has, worked out from their row so
     * each re-run gives the same documents, birthday and bank account.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function defaults(array $row): array
    {
        $seed = crc32($row['name']);
        $documentsExpire = today()->addDays(240 + $seed % 600)->toDateString();
        $paidByBank = ($row['method'] ?? 'bank_transfer') === 'bank_transfer';

        return [
            'full_name' => $row['name'],
            'gender' => $row['gender'] ?? 'male',
            'nationality' => $row['nationality'],
            'date_of_birth' => sprintf('%d-%02d-%02d', 1972 + $seed % 28, 1 + $seed % 12, 1 + $seed % 28),
            'phone' => sprintf('+971 5%d %03d %04d', $seed % 9, $seed % 1000, $seed % 10000),
            'email' => in_array($row['at'], ['hq', 'Dubai Region', 'Northern Emirates Region'], true)
                ? strtolower(strtok($row['name'], ' ')).'.'.strtolower(substr(strrchr($row['name'], ' '), 1)).'@horizonfm.test'
                : null,
            'employment_type' => 'full_time',
            'joined_on' => $row['joined'],
            'status' => 'active',
            'emirates_id_number' => sprintf('784-%d-%07d-%d', 1972 + $seed % 28, $seed % 10000000, $seed % 10),
            'emirates_id_expiry' => $documentsExpire,
            'passport_number' => sprintf('%s%07d', chr(65 + $seed % 26), $seed % 10000000),
            'passport_expiry' => today()->addDays(900 + $seed % 1200)->toDateString(),
            'visa_number' => sprintf('201/%d/%07d', CarbonImmutable::parse($row['joined'])->year, $seed % 10000000),
            'visa_expiry' => $documentsExpire,
            'basic_salary' => $row['salary'][0],
            'housing_allowance' => $row['salary'][1] ?? 0,
            'transport_allowance' => $row['salary'][2] ?? 0,
            'other_allowance' => $row['salary'][3] ?? 0,
            'salary_payment_method' => $row['method'] ?? 'bank_transfer',
            'bank_name' => $paidByBank ? self::BANKS[$seed % count(self::BANKS)] : null,
            'iban' => $paidByBank ? sprintf('AE%02d0%02d%016d', 10 + $seed % 89, 20 + $seed % 70, $seed) : null,
            'emergency_contact_name' => $row['emergency'][0] ?? null,
            'emergency_contact_phone' => $row['emergency'][1] ?? null,
        ];
    }

    /**
     * Mark everyone's attendance from the first of last month to yesterday,
     * and today at the camps: the weekend off (Friday at the camps), a few
     * absences, half days and sick days, and leave for whoever is on it.
     */
    private function markAttendance(Company $company, ?User $user): void
    {
        $from = CarbonImmutable::today()->subMonthNoOverflow()->startOfMonth();
        $today = CarbonImmutable::today();
        $staff = $company->staffMembers()->employedBetween($from, $today)->with('role:id,slug')->get();
        $marked = $company->staffAttendances()
            ->whereDate('work_date', '>=', $from)
            ->get(['staff_member_id', 'work_date'])
            ->map(fn (StaffAttendance $attendance) => "{$attendance->staff_member_id}|{$attendance->work_date->toDateString()}")
            ->flip();
        $model = new StaffAttendance;
        $now = now();
        $rows = [];

        foreach ($staff as $member) {
            $isSite = $member->work_level === 'site';
            $lastDay = $isSite ? $today : $today->subDay();
            $until = $member->left_on ? CarbonImmutable::parse($member->left_on)->min($lastDay) : $lastDay;

            for ($day = $from->max(CarbonImmutable::parse($member->joined_on)); $day->lte($until); $day = $day->addDay()) {
                if ($marked->has("{$member->id}|{$day->toDateString()}")) {
                    continue;
                }

                $status = $this->dayStatus($member, $day, $isSite);
                $isNightShift = $member->role->slug === 'security_guard' && $member->id % 2 === 0;
                [$in, $out] = $isNightShift ? ['19:00', '07:00'] : ($isSite ? ['07:00', '16:00'] : ['08:30', '17:30']);

                $rows[] = [
                    'company_id' => $company->id,
                    'staff_member_id' => $member->id,
                    'work_date' => $model->fromDateTime($day),
                    'status' => $status,
                    'check_in' => in_array($status, ['present', 'half_day'], true) ? $in : null,
                    'check_out' => match ($status) {
                        'present' => $out,
                        'half_day' => $isNightShift ? '01:00' : ($isSite ? '11:00' : '13:00'),
                        default => null,
                    },
                    'note' => match ($status) {
                        'half_day' => 'Left early, approved by supervisor',
                        'leave' => $member->status === 'on_leave' ? 'Annual leave' : 'Sick leave',
                        default => null,
                    },
                    'recorded_by' => $user?->id,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            StaffAttendance::query()->insert($chunk);
        }
    }

    /**
     * A believable day: the weekend off, leave for whoever is on it, and
     * now and then an absence, a half day or a sick day.
     */
    private function dayStatus(StaffMember $member, CarbonImmutable $day, bool $isSite): string
    {
        $isWeekend = $isSite ? $day->isFriday() : $day->isWeekend();
        $roll = crc32($member->full_name.$day->toDateString()) % 100;

        return match (true) {
            $isWeekend => 'day_off',
            $member->status === 'on_leave' && $day->gt(today()->subDays(12)) => 'leave',
            $roll < 3 => 'absent',
            $roll < 6 => 'half_day',
            $roll < 8 => 'leave',
            default => 'present',
        };
    }

    /**
     * Last month's payroll, paid on the first of this month; this month's
     * prepared but not yet paid.
     */
    private function preparePayroll(Company $company, ?User $user): void
    {
        $thisMonth = CarbonImmutable::today()->startOfMonth();
        $lastMonth = $thisMonth->subMonthNoOverflow();

        SalaryPayment::prepareMonth($company, $lastMonth);
        $company->salaryPayments()
            ->whereDate('period', $lastMonth)
            ->where('status', 'pending')
            ->with('staffMember:id,salary_payment_method')
            ->get()
            ->each(fn (SalaryPayment $salary) => $salary->markPaid($thisMonth, $salary->staffMember->salary_payment_method, 'WPS-'.$lastMonth->format('Ym'), $user));

        SalaryPayment::prepareMonth($company, $thisMonth);
    }

    /**
     * The demo staff. `at` is `hq`, a regional office's name or a property
     * code; `salary` is basic pay, housing, transport and other allowances;
     * `set` overrides any detail.
     *
     * @return list<array<string, mixed>>
     */
    private function staff(): array
    {
        $al = PropertySeeder::AL_QUOZ;
        $ja = PropertySeeder::JEBEL_ALI;
        $today = today();

        return [
            // Head office.
            ['name' => 'Khalid Al Mansoori', 'nationality' => 'Emirati', 'role' => 'ceo_managing_director', 'at' => 'hq', 'joined' => '2018-01-07', 'salary' => [35000, 12000, 3000]],
            ['name' => 'Rajesh Menon', 'nationality' => 'Indian', 'role' => 'director_of_operations', 'at' => 'hq', 'joined' => '2019-04-01', 'salary' => [22000, 8000, 2000], 'emergency' => ['Priya Menon', '+971 50 118 4420']],
            ['name' => 'Fatima Al Zarooni', 'gender' => 'female', 'nationality' => 'Emirati', 'role' => 'chief_financial_officer', 'at' => 'hq', 'joined' => '2020-02-16', 'salary' => [26000, 9000, 2000]],
            ['name' => 'Maria Santos', 'gender' => 'female', 'nationality' => 'Filipino', 'role' => 'head_of_hr_admin', 'at' => 'hq', 'joined' => '2020-09-01', 'salary' => [14000, 5000, 1000], 'set' => ['passport_expiry' => $today->copy()->addDays(45)->toDateString()]],
            ['name' => 'Ahmed Farouk', 'nationality' => 'Egyptian', 'role' => 'lease_contract_administrator', 'at' => 'hq', 'joined' => '2021-05-10', 'salary' => [9000, 3500, 800]],
            ['name' => 'Sanjay Kapoor', 'nationality' => 'Indian', 'role' => 'sales_manager', 'at' => 'hq', 'joined' => '2021-11-01', 'salary' => [12000, 4000, 1500, 2000]],
            ['name' => 'Bilal Hussain', 'nationality' => 'Pakistani', 'role' => 'sales_executive', 'at' => 'hq', 'joined' => '2023-03-15', 'salary' => [6000, 2500, 1000]],
            ['name' => 'Grace Dela Cruz', 'gender' => 'female', 'nationality' => 'Filipino', 'role' => 'administrator', 'at' => 'hq', 'joined' => '2022-06-01', 'salary' => [5500, 2000, 500]],
            ['name' => 'Vinod Kumar', 'nationality' => 'Indian', 'role' => 'accountant', 'at' => 'hq', 'joined' => '2021-01-10', 'salary' => [8000, 3000, 700]],
            ['name' => 'Imran Qureshi', 'nationality' => 'Pakistani', 'role' => 'purchase_officer', 'at' => 'hq', 'joined' => '2022-10-03', 'salary' => [7000, 2500, 700]],
            ['name' => 'Layla Haddad', 'gender' => 'female', 'nationality' => 'Lebanese', 'role' => 'legal_compliance_counsel', 'at' => 'hq', 'joined' => '2023-08-20', 'salary' => [18000, 6000, 1500]],

            // Regional offices.
            ['name' => 'Tariq Mahmood', 'nationality' => 'Pakistani', 'role' => 'regional_manager', 'at' => 'Dubai Region', 'joined' => '2020-06-01', 'salary' => [15000, 5000, 1500]],
            ['name' => 'Anjali Nair', 'gender' => 'female', 'nationality' => 'Indian', 'role' => 'regional_administrator', 'at' => 'Dubai Region', 'joined' => '2022-02-14', 'salary' => [6500, 2500, 600]],
            ['name' => 'Arun Pillai', 'nationality' => 'Indian', 'role' => 'regional_accountant', 'at' => 'Dubai Region', 'joined' => '2021-09-05', 'salary' => [7500, 2800, 600]],
            ['name' => 'Omar Saeed', 'nationality' => 'Sudanese', 'role' => 'regional_manager', 'at' => 'Northern Emirates Region', 'joined' => '2022-11-01', 'salary' => [14000, 4500, 1500]],

            // Al Quoz camp. Camp staff live on site, so they have no housing allowance.
            ['name' => 'Joseph Mathew', 'nationality' => 'Indian', 'role' => 'property_boss', 'at' => $al, 'joined' => '2019-08-01', 'salary' => [6500, 0, 500, 500], 'emergency' => ['Annie Mathew', '+91 94470 22118']],
            ['name' => 'Ram Bahadur Thapa', 'nationality' => 'Nepali', 'role' => 'assistant_camp_boss', 'at' => $al, 'joined' => '2021-03-10', 'salary' => [3500, 0, 300]],
            ['name' => 'Sohel Rana', 'nationality' => 'Bangladeshi', 'role' => 'assistant_camp_boss', 'at' => $al, 'joined' => '2023-01-15', 'salary' => [3200, 0, 300]],
            ['name' => 'Deepak Sharma', 'nationality' => 'Indian', 'role' => 'site_accountant', 'at' => $al, 'joined' => '2022-04-01', 'salary' => [4500, 0, 400]],
            ['name' => 'Abdul Karim', 'nationality' => 'Bangladeshi', 'role' => 'maintenance_person', 'at' => $al, 'joined' => '2020-10-12', 'salary' => [2500, 0, 200]],
            ['name' => 'Manoj Yadav', 'nationality' => 'Indian', 'role' => 'maintenance_person', 'at' => $al, 'joined' => '2023-06-01', 'salary' => [2300, 0, 200]],
            ['name' => 'Rosa Mendoza', 'gender' => 'female', 'nationality' => 'Filipino', 'role' => 'cleaning_manager', 'at' => $al, 'joined' => '2022-01-20', 'salary' => [3800, 0, 300]],
            ['name' => 'Hari Prasad Adhikari', 'nationality' => 'Nepali', 'role' => 'cleaner', 'at' => $al, 'joined' => '2021-07-01', 'salary' => [1600], 'method' => 'cash', 'set' => ['visa_expiry' => $today->copy()->addDays(20)->toDateString(), 'emirates_id_expiry' => $today->copy()->addDays(20)->toDateString()]],
            ['name' => 'Mohammad Alamgir', 'nationality' => 'Bangladeshi', 'role' => 'cleaner', 'at' => $al, 'joined' => '2022-09-12', 'salary' => [1500], 'method' => 'cash'],
            ['name' => 'Suresh Gurung', 'nationality' => 'Nepali', 'role' => 'cleaner', 'at' => $al, 'joined' => $today->copy()->subDays(12)->toDateString(), 'salary' => [1500], 'method' => 'cash', 'set' => ['employment_type' => 'temporary']],
            ['name' => 'Peter Okafor', 'nationality' => 'Nigerian', 'role' => 'security_guard', 'at' => $al, 'joined' => '2021-12-01', 'salary' => [2200], 'set' => ['emirates_id_expiry' => $today->copy()->subDays(5)->toDateString()]],
            ['name' => 'Gurpreet Singh', 'nationality' => 'Indian', 'role' => 'security_guard', 'at' => $al, 'joined' => '2022-05-16', 'salary' => [2200]],

            // Jebel Ali building.
            ['name' => 'Faisal Iqbal', 'nationality' => 'Pakistani', 'role' => 'property_boss', 'at' => $ja, 'joined' => '2020-03-01', 'salary' => [6000, 0, 500]],
            ['name' => 'Krishna Bhandari', 'nationality' => 'Nepali', 'role' => 'assistant_camp_boss', 'at' => $ja, 'joined' => '2022-08-08', 'salary' => [3300, 0, 300], 'set' => ['status' => 'on_leave']],
            ['name' => 'Nadeem Akhtar', 'nationality' => 'Pakistani', 'role' => 'maintenance_person', 'at' => $ja, 'joined' => '2021-02-01', 'salary' => [2400, 0, 200]],
            ['name' => 'Jasmine Reyes', 'gender' => 'female', 'nationality' => 'Filipino', 'role' => 'cleaner', 'at' => $ja, 'joined' => '2023-02-01', 'salary' => [1600], 'method' => 'cash'],
            ['name' => 'Rafiqul Islam', 'nationality' => 'Bangladeshi', 'role' => 'cleaner', 'at' => $ja, 'joined' => '2021-04-19', 'salary' => [1500], 'method' => 'cash', 'set' => ['status' => 'resigned', 'left_on' => $today->copy()->startOfMonth()->subDays(6)->toDateString()]],
            ['name' => 'Samuel Mensah', 'nationality' => 'Ghanaian', 'role' => 'security_guard', 'at' => $ja, 'joined' => '2022-07-01', 'salary' => [2200]],
        ];
    }
}
