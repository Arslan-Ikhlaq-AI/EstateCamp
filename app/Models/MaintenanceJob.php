<?php

namespace App\Models;

use App\Models\Concerns\HasDocumentNumber;
use Carbon\CarbonInterface;
use Database\Factories\MaintenanceJobFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * One problem to fix at a property, such as a leaking tap in a room or a
 * burnt water motor: where it is, what kind of problem, who reported it and
 * who fixes it. It moves through the company's maintenance statuses, each
 * move kept in its history. Once the work is finished it carries the amount
 * charged and the invoice, which later count as the property's maintenance
 * expenses. Paying the bill issues a payment voucher (PV-2026-0001) as the
 * company's record of the money going out.
 *
 * The invoice is kept on the private disk and served only to the company's
 * own users.
 */
#[Fillable([
    'location',
    'maintenance_category_id',
    'title',
    'description',
    'priority',
    'reported_on',
    'reported_by',
    'vendor_name',
    'vendor_phone',
    'completed_on',
    'amount',
    'payment_method',
    'paid_on',
    'invoice_number',
    'notes',
])]
class MaintenanceJob extends Model
{
    /** @use HasFactory<MaintenanceJobFactory> */
    use HasDocumentNumber, HasFactory, SoftDeletes;

    public const NUMBER_PREFIX = 'MNT';

    public const NUMBER_COLUMN = 'job_number';

    public const VOUCHER_PREFIX = 'PV';

    /**
     * Where in the property the problem is: the property as a whole (a
     * common area, the roof, the pump room) or one of its units.
     */
    public const UNIT_TYPES = ['property', 'room', 'apartment', 'shop'];

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

    public const PAYMENT_METHODS = ['cash', 'cheque', 'bank_transfer', 'card'];

    /**
     * The disk holding invoices.
     */
    public const INVOICE_DISK = 'local';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reported_on' => 'date',
            'started_on' => 'date',
            'completed_on' => 'date',
            'paid_on' => 'date',
            'handed_over_at' => 'datetime',
            'amount' => 'decimal:2',
        ];
    }

    /**
     * Put the job at a property, or at one room, apartment or shop in it.
     */
    public function placeAt(Property $property, string $unitType, ?int $unitId = null): void
    {
        $this->forceFill([
            'company_id' => $property->company_id,
            'property_id' => $property->id,
            'unit_type' => $unitType,
            'room_id' => $unitType === 'room' ? $unitId : null,
            'apartment_id' => $unitType === 'apartment' ? $unitId : null,
            'shop_id' => $unitType === 'shop' ? $unitId : null,
        ]);
    }

    /**
     * Move the job to `$status` on `$on` and note it in the history. Work
     * starting or finishing sets the start date if it has none; finishing
     * sets the completion date (kept when going from one finished status to
     * another), and reopening the job clears it. A new job is saved and its
     * first history entry records it being reported.
     */
    public function moveTo(MaintenanceStatus $status, CarbonInterface $on, ?string $note = null, ?User $by = null): void
    {
        DB::transaction(function () use ($status, $on, $note, $by) {
            $previous = $this->status;
            $wasCompleted = $previous?->isCompleted() && $this->completed_on !== null;

            $this->forceFill([
                'maintenance_status_id' => $status->id,
                'started_on' => in_array($status->stage, ['in_progress', 'completed'], true) ? ($this->started_on ?? $on) : $this->started_on,
                'completed_on' => $status->isCompleted() ? ($wasCompleted ? $this->completed_on : $on) : null,
            ])->save();
            $this->setRelation('status', $status);

            $this->updates()->create([
                'maintenance_status_id' => $status->id,
                'previous_status_id' => $previous?->id,
                'changed_on' => $on,
                'note' => filled($note) ? trim($note) : null,
                'user_id' => $by?->id,
            ]);
        });
    }

    /**
     * Record what the work cost: the amount, how and when it was paid, the
     * invoice number and the invoice itself (replacing or removing the one
     * on file). Only the keys given are changed.
     *
     * @param  array{amount?: mixed, payment_method?: ?string, paid_on?: ?string, invoice_number?: ?string, invoice?: ?UploadedFile, remove_invoice?: bool}  $cost
     */
    public function recordCost(array $cost): void
    {
        $this->fill(Arr::only($cost, ['amount', 'payment_method', 'paid_on', 'invoice_number']));
        $this->syncVoucher();
        $this->syncHandover();
        $this->save();

        if (! empty($cost['remove_invoice'])) {
            $this->removeInvoice();
        }

        if (($cost['invoice'] ?? null) instanceof UploadedFile) {
            $this->storeInvoice($cost['invoice']);
        }
    }

    /**
     * Save the invoice, replacing any earlier one.
     */
    public function storeInvoice(UploadedFile $file): void
    {
        $this->removeInvoice();

        $path = $file->storeAs(
            "maintenance/{$this->company_id}/{$this->id}",
            'invoice-'.Str::random(12).'.'.($file->extension() ?: 'pdf'),
            self::INVOICE_DISK,
        );

        $this->forceFill(['invoice_path' => $path, 'invoice_name' => Str::limit($file->getClientOriginalName(), 250, '')])->save();
    }

    public function removeInvoice(): void
    {
        if ($this->invoice_path) {
            Storage::disk(self::INVOICE_DISK)->delete($this->invoice_path);
            $this->forceFill(['invoice_path' => null, 'invoice_name' => null])->save();
        }
    }

    public function isPaid(): bool
    {
        return $this->paid_on !== null;
    }

    /**
     * Finished work with an amount to pay: a bill for the payments pages.
     */
    public function isBill(): bool
    {
        return (float) $this->amount > 0;
    }

    /**
     * Whether this is a bill the camp boss paid in cash out of the cash
     * collected, not yet settled with an admin in a handover.
     */
    public function awaitsHandover(): bool
    {
        return $this->isPaid() && $this->isBill() && $this->payment_method === 'cash' && $this->handed_over_at === null;
    }

    /**
     * Record that the bill was paid on `$on`, issuing its payment voucher.
     */
    public function markPaid(CarbonInterface $on, string $method, ?string $reference = null, ?User $by = null): void
    {
        $this->forceFill([
            'paid_on' => $on,
            'payment_method' => $method,
            'payment_reference' => filled($reference) ? trim($reference) : null,
            'paid_by' => $by?->id,
        ]);
        $this->syncVoucher();
        $this->save();
    }

    /**
     * Undo a payment recorded by mistake; its voucher is cancelled with it.
     */
    public function markUnpaid(): void
    {
        $this->forceFill(['paid_on' => null, 'payment_reference' => null, 'paid_by' => null]);
        $this->syncVoucher();
        $this->syncHandover();
        $this->save();
    }

    /**
     * An unpaid bill is no longer part of a cash handover.
     */
    private function syncHandover(): void
    {
        if ($this->paid_on === null) {
            $this->forceFill(['handed_over_at' => null, 'handed_over_to' => null]);
        }
    }

    /**
     * A paid job carries a voucher number; an unpaid one has none.
     */
    private function syncVoucher(): void
    {
        if ($this->paid_on !== null && $this->voucher_number === null) {
            $this->voucher_number = self::nextNumberIn('voucher_number', self::VOUCHER_PREFIX, $this->company_id, $this->paid_on);
        } elseif ($this->paid_on === null) {
            $this->voucher_number = null;
        }
    }

    /**
     * Jobs whose status is in one of `$stages`.
     *
     * @param  Builder<MaintenanceJob>  $query
     * @param  list<string>|string  $stages
     */
    #[Scope]
    protected function inStage(Builder $query, array|string $stages): void
    {
        $query->whereIn('maintenance_jobs.maintenance_status_id', MaintenanceStatus::query()->whereIn('stage', (array) $stages)->select('id'));
    }

    /**
     * @return BelongsTo<Company, $this>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return BelongsTo<Room, $this>
     */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * @return BelongsTo<Apartment, $this>
     */
    public function apartment(): BelongsTo
    {
        return $this->belongsTo(Apartment::class);
    }

    /**
     * @return BelongsTo<Shop, $this>
     */
    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    /**
     * @return BelongsTo<MaintenanceCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(MaintenanceCategory::class, 'maintenance_category_id');
    }

    /**
     * @return BelongsTo<MaintenanceStatus, $this>
     */
    public function status(): BelongsTo
    {
        return $this->belongsTo(MaintenanceStatus::class, 'maintenance_status_id');
    }

    /**
     * The job's history, oldest first.
     *
     * @return HasMany<MaintenanceJobUpdate, $this>
     */
    public function updates(): HasMany
    {
        return $this->hasMany(MaintenanceJobUpdate::class)->orderBy('changed_on')->orderBy('id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Who recorded the payment of the bill.
     *
     * @return BelongsTo<User, $this>
     */
    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    /**
     * The admin who settled this cash payment in a handover with the camp
     * boss.
     *
     * @return BelongsTo<User, $this>
     */
    public function handedOverTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handed_over_to');
    }
}
