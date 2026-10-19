<?php

use App\Models\Cheque;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}

/**
 * Record the number, bank and a front photo of every cheque an agreement
 * needs this year, as staff do when the cheques are handed over. Fake the
 * private disk first.
 */
function collectChequesDueThisYear(Model $agreement): void
{
    [, $yearEnd] = $agreement->currentChequeYear();

    $agreement->cheques()
        ->where('status', 'pending')
        ->whereDate('cheque_date', '<=', $yearEnd)
        ->get()
        ->each(fn (Cheque $cheque) => $cheque->applyEntry([
            'cheque_number' => (string) (100000 + $cheque->id),
            'bank_name' => 'Emirates NBD',
            'front_image' => UploadedFile::fake()->image('front.jpg'),
        ]));
}
