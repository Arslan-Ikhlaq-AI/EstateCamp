<?php

namespace App\Models\Concerns;

use App\Models\Client;
use App\Models\Company;
use App\Models\Property;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Validation\ValidationException;

/**
 * Money taken with a contract or a short-term rental, in cash or by cheque,
 * and kept apart from the agreement's rent. It is pending until it arrives.
 * A cheque's details stay on the record and never reach the cheque register.
 */
trait ComesWithAgreement
{
    use LimitedToCamps;

    public const STATUSES = ['pending', 'received', 'cancelled'];

    /**
     * How the money can be taken. Older records may say `bank_transfer` or `card`.
     */
    public const METHODS = ['cash', 'cheque'];

    /**
     * Camp staff can save an agreement that spans camps, so the record
     * follows its agreement, which has already been checked.
     *
     * @param  list<int>  $propertyIds
     */
    public function isAtCamps(array $propertyIds): bool
    {
        return true;
    }

    /**
     * The money arrived.
     *
     * @param  array{method: string, cheque_number?: ?string, bank_name?: ?string, cheque_date?: mixed}  $details
     *
     * @throws ValidationException When the record is not waiting for its money.
     */
    public function receive(CarbonInterface $on, array $details): void
    {
        if ($this->status !== 'pending') {
            throw ValidationException::withMessages(['received_on' => 'This has already been received or was cancelled.']);
        }

        $this->forceFill(['status' => 'received', 'received_on' => $on, ...self::paymentColumns($details)])->save();
    }

    /**
     * Stop counting the record, or count it again. It goes back to pending
     * or to received, depending on whether its money had arrived.
     *
     * @throws ValidationException When some of the money has been settled.
     */
    public function changeStatus(bool $isCancelled): void
    {
        if ($isCancelled && (float) $this->settled_amount > 0) {
            throw ValidationException::withMessages(['status' => 'Undo its settlements before cancelling this.']);
        }

        $this->forceFill(['status' => $isCancelled ? 'cancelled' : ($this->received_on ? 'received' : 'pending')])->save();
    }

    /**
     * The payment columns for `$details`, leaving a cheque's details out
     * unless it was paid by cheque.
     *
     * @param  array{method: ?string, cheque_number?: ?string, bank_name?: ?string, cheque_date?: mixed}  $details
     * @return array{method: ?string, cheque_number: ?string, bank_name: ?string, cheque_date: mixed}
     */
    public static function paymentColumns(array $details): array
    {
        $isCheque = $details['method'] === 'cheque';

        return [
            'method' => $details['method'],
            'cheque_number' => $isCheque ? trim((string) $details['cheque_number']) : null,
            'bank_name' => $isCheque ? trim((string) $details['bank_name']) : null,
            'cheque_date' => $isCheque ? $details['cheque_date'] : null,
        ];
    }

    /**
     * The contract or short-term rental the money came with.
     *
     * @return MorphTo<Model, $this>
     */
    public function agreement(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * The property the agreement is for; a contract across several gives
     * the one holding most of its units.
     *
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * Who paid it.
     *
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
