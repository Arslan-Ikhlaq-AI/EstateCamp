<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A step a cheque moves through, named on the configuration page (such as
 * Created, Submitted or Approved). Its stage tells the application what the
 * step means, whatever it is called: it is the cheque's own `status`
 * (expected, in hand, handed over, at the bank, cleared, bounced, handed
 * back or cancelled), so moving a cheque into a status of another stage
 * does what reaching that stage does, such as recording the payment.
 *
 * Reference data; the starter rows are inserted by the create_cheque_statuses_table migration.
 */
#[Fillable(['name', 'slug', 'description', 'stage', 'color', 'sort_order', 'is_active'])]
class ChequeStatus extends Model
{
    public const STAGES = Cheque::STATUSES;

    /**
     * Badge colours a status can be shown in.
     */
    public const COLORS = ['cyan', 'navy', 'amber', 'green', 'red', 'grey'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * The status a cheque takes on reaching `$stage`: the stage's first
     * active one in order, or its first one when all are switched off.
     */
    public static function firstIn(string $stage): ?self
    {
        return self::query()->where('stage', $stage)->orderByDesc('is_active')->orderBy('sort_order')->orderBy('id')->first();
    }

    /**
     * The cheques this status can apply to: received, issued or both, as its stage allows.
     *
     * @return list<string>
     */
    public function directions(): array
    {
        return array_keys(array_filter(Cheque::DIRECTION_STATUSES, fn (array $stages) => in_array($this->stage, $stages, true)));
    }

    /**
     * @return HasMany<Cheque, $this>
     */
    public function cheques(): HasMany
    {
        return $this->hasMany(Cheque::class);
    }
}
