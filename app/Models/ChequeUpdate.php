<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One entry in a cheque's history: it moved from one status to another on
 * `changed_on`, by whom and why.
 */
#[Fillable(['cheque_status_id', 'previous_status_id', 'changed_on', 'note', 'user_id'])]
class ChequeUpdate extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'changed_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Cheque, $this>
     */
    public function cheque(): BelongsTo
    {
        return $this->belongsTo(Cheque::class);
    }

    /**
     * @return BelongsTo<ChequeStatus, $this>
     */
    public function status(): BelongsTo
    {
        return $this->belongsTo(ChequeStatus::class, 'cheque_status_id');
    }

    /**
     * @return BelongsTo<ChequeStatus, $this>
     */
    public function previousStatus(): BelongsTo
    {
        return $this->belongsTo(ChequeStatus::class, 'previous_status_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
