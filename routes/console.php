<?php

use App\Models\Contract;
use App\Models\HeadLease;
use App\Models\Room;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('leasing:refresh', function () {
    $ended = 0;

    Contract::query()
        ->where('status', 'active')
        ->whereDate('end_date', '<', today())
        ->each(function (Contract $contract) use (&$ended) {
            $contract->markEnded();
            $ended++;
        });

    $expired = HeadLease::query()
        ->where('status', 'active')
        ->whereDate('end_date', '<', today())
        ->update(['status' => 'expired']);

    // Lines that start or finish today change what their apartments and shops show.
    Contract::query()->where('status', 'active')->each(fn (Contract $contract) => $contract->syncUnitStatuses());

    // So do short-term rentals and stays that start or finish today for rooms.
    Room::query()->each(fn (Room $room) => $room->recalculateOccupancy());

    $this->info("{$ended} contract(s) ended and {$expired} head lease(s) expired.");
})->purpose('End contracts and expire head leases whose term has passed, then refresh apartment and shop statuses and the beds taken in rooms');

Schedule::command('leasing:refresh')->dailyAt('00:15');
