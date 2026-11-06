<?php

namespace App\Models;

use Database\Factories\SettlementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Money paid out of a commission, a deposit or extra income: the day, how
 * much, who to, how, and why. Settled money leaves what the company holds
 * and never reaches its expenses.
 */
#[Fillable([
    'settled_on',
    'amount',
    'paid_to',
    'method',
    'reference',
    'notes',
])]
class Settlement extends Model
{
    /** @use HasFactory<SettlementFactory> */
    use HasFactory;

    public const METHODS = ['cash', 'bank_transfer', 'cheque'];

    /**
     * The kinds of money that can be settled, as the morph map names them.
     *
     * @var array<string, class-string<Commission|Deposit|ExtraIncome>>
     */
    public const KINDS = ['commission' => Commission::class, 'deposit' => Deposit::class, 'extra_income' => ExtraIncome::class];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settled_on' => 'date',
            'amount' => 'decimal:2',
        ];
    }

    /**
     * The commission, deposit or extra income the money came out of.
     *
     * @return MorphTo<Model, $this>
     */
    public function settleable(): MorphTo
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
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
