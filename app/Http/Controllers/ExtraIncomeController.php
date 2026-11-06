<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltersByPeriod;
use App\Http\Controllers\Concerns\ListsRecords;
use App\Http\Controllers\Concerns\ReadsExtraPayments;
use App\Http\Requests\ExtraIncomeRequest;
use App\Http\Requests\ExtraIncomeStatusRequest;
use App\Models\Company;
use App\Models\ExtraIncome;
use App\Models\Settlement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Extra income: money a property earns besides rent, such as the share an
 * internet, gas or washing machine provider pays for serving the building.
 * One of the extra payments: it stays out of payments, revenue and reports,
 * and is held until it is settled.
 */
class ExtraIncomeController extends Controller
{
    use FiltersByPeriod, ListsRecords, ReadsExtraPayments;

    /**
     * Settlements listed under the table.
     */
    private const SETTLEMENT_ROWS = 20;

    /**
     * List the extra income, latest first, received in a period when one is chosen.
     */
    public function index(Request $request): Response
    {
        $company = Company::find($request->user()->company_id);

        if (! $company) {
            return Inertia::render('ExtraIncome/Index', ['company' => null]);
        }

        $period = $this->periodFilter($request);
        $standings = array_values(array_diff(ExtraIncome::STANDINGS, ['to_collect']));
        $properties = $company->properties()->orderBy('name')->get(['id', 'name', 'code']);
        $filters = [
            ...$this->listFilters($request, ['method' => ExtraIncome::METHODS, 'standing' => $standings]),
            'period' => $period['value'],
            'property' => (string) $properties->firstWhere('id', $request->integer('property'))?->id,
        ];
        $incomes = fn (?string $except = null) => $this->filteredQuery($company, $filters, $period, $except);

        return Inertia::render('ExtraIncome/Index', [
            'company' => ['currency' => $company->default_currency],
            'filters' => $filters,
            'period' => $period,
            'facets' => [
                'standing' => $this->facetOptions($standings, $this->standingCounts($incomes('standing'))),
                'method' => $this->facetOptions(ExtraIncome::METHODS, $this->countBy($incomes('method'), 'method')),
            ],
            'properties' => $properties,
            'summary' => $this->moneyFigures($incomes()),
            'settlements' => $this->settlementHistory(['extra_income' => $incomes()], self::SETTLEMENT_ROWS),
            'incomes' => $incomes()
                ->with(['property:id,name,code', 'settlements' => fn ($query) => $query->with('createdBy:id,name')->orderBy('settled_on')->orderBy('id')])
                ->orderByDesc('received_on')
                ->orderByDesc('id')
                ->paginate($filters['perPage'])
                ->withQueryString()
                ->through(fn (ExtraIncome $income) => self::details($income)),
            'settlementMethods' => Settlement::METHODS,
        ]);
    }

    /**
     * Show the form for new extra income, for `?property=` when it is given.
     */
    public function create(Request $request): Response
    {
        $company = $this->currentCompany($request);
        $property = $company->properties()->find($request->integer('property'));

        return Inertia::render('ExtraIncome/Form', [
            'income' => null,
            'defaults' => ['property_id' => $property?->id],
            ...$this->formOptions($company),
        ]);
    }

    /**
     * Save new extra income, received.
     */
    public function store(ExtraIncomeRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);
        $property = $company->properties()->findOrFail($request->validated('property_id'));

        $income = DB::transaction(function () use ($request, $company, $property) {
            $income = new ExtraIncome($request->details());
            $income->forceFill([
                'company_id' => $company->id,
                'property_id' => $property->id,
                'income_number' => ExtraIncome::nextNumber($company->id),
                'status' => 'received',
                'created_by' => $request->user()->id,
            ])->save();
            $this->syncInvoice($income, $request);

            return $income;
        });

        return to_route('extra-incomes.index')->with('success', "{$income->income_number} from {$income->received_from} was received.");
    }

    /**
     * Show the form for correcting extra income; it is cancelled from the lists.
     */
    public function edit(Request $request, ExtraIncome $extraIncome): Response
    {
        $this->ensureSameCompany($request, $extraIncome);

        return Inertia::render('ExtraIncome/Form', [
            'income' => [
                'id' => $extraIncome->id,
                'number' => $extraIncome->income_number,
                'status' => $extraIncome->status,
                ...$extraIncome->only(['property_id', 'title', 'received_from', 'method', 'invoice_number', 'notes', 'invoice_name']),
                'amount' => (float) $extraIncome->amount,
                'received_on' => $extraIncome->received_on->toDateString(),
                'invoice_url' => self::invoiceUrl($extraIncome),
            ],
            'defaults' => ['property_id' => null],
            ...$this->formOptions($extraIncome->company),
        ]);
    }

    public function update(ExtraIncomeRequest $request, ExtraIncome $extraIncome): RedirectResponse
    {
        $property = $extraIncome->company->properties()->findOrFail($request->validated('property_id'));

        DB::transaction(function () use ($request, $extraIncome, $property) {
            $extraIncome->fill($request->details());
            $extraIncome->property_id = $property->id;
            $extraIncome->save();
            $this->syncInvoice($extraIncome, $request);
        });

        return to_route('extra-incomes.index')->with('success', "{$extraIncome->income_number} was updated.");
    }

    /**
     * Cancel extra income added by mistake, or count it as received again.
     */
    public function changeStatus(ExtraIncomeStatusRequest $request, ExtraIncome $extraIncome): RedirectResponse
    {
        $extraIncome->forceFill(['status' => $request->validated('status')])->save();

        $message = $extraIncome->isReceived() ? 'counts as received again' : 'was cancelled';

        return back()->with('success', "{$extraIncome->income_number} {$message}.");
    }

    /**
     * The income's invoice, for the company's own users only.
     */
    public function invoice(Request $request, ExtraIncome $extraIncome): StreamedResponse
    {
        $this->ensureSameCompany($request, $extraIncome);

        $path = $extraIncome->invoice_path;

        abort_unless($path && Storage::disk(ExtraIncome::INVOICE_DISK)->exists($path), 404);

        return Storage::disk(ExtraIncome::INVOICE_DISK)->response($path, $extraIncome->invoice_name, ['Cache-Control' => 'private, max-age=3600']);
    }

    /**
     * One income as the lists show it.
     *
     * @return array<string, mixed>
     */
    public static function details(ExtraIncome $income): array
    {
        return [
            ...self::moneyDetails($income, 'extra_income'),
            'title' => $income->title,
            'receivedFrom' => $income->received_from,
            'date' => $income->received_on->toDateString(),
            'invoiceNumber' => $income->invoice_number,
            'notes' => $income->notes,
            'invoiceUrl' => self::invoiceUrl($income),
            'property' => $income->relationLoaded('property') ? $income->property?->only(['id', 'name', 'code']) : null,
        ];
    }

    private static function invoiceUrl(ExtraIncome $income): ?string
    {
        return $income->invoice_path ? route('extra-incomes.invoice', [$income, 'v' => $income->updated_at?->timestamp]) : null;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array{from: ?string, to: ?string}  $period
     * @return Builder<ExtraIncome>
     */
    private function filteredQuery(Company $company, array $filters, array $period, ?string $except = null): Builder
    {
        $search = $filters['search'];

        return $this->wherePeriod(ExtraIncome::query()->where('company_id', $company->id), 'received_on', $period)
            ->when($search !== '', fn (Builder $query) => $query->where(fn (Builder $query) => $query
                ->whereLike('income_number', "%{$search}%")
                ->orWhereLike('title', "%{$search}%")
                ->orWhereLike('received_from', "%{$search}%")
                ->orWhereLike('invoice_number', "%{$search}%")
                ->orWhereHas('property', fn (Builder $properties) => $properties->whereLike('name', "%{$search}%")->orWhereLike('code', "%{$search}%"))))
            ->when($except !== 'method' && $filters['method'] !== [], fn (Builder $query) => $query->whereIn('method', $filters['method']))
            ->when($except !== 'standing' && $filters['standing'] !== [], fn (Builder $query) => $query->standingIn($filters['standing']))
            ->when($filters['property'] !== '', fn (Builder $query) => $query->where('property_id', $filters['property']));
    }

    /**
     * Replace or remove the invoice as the form asked.
     */
    private function syncInvoice(ExtraIncome $income, ExtraIncomeRequest $request): void
    {
        if ($request->boolean('remove_invoice')) {
            $income->removeInvoice();
        }

        if ($request->file('invoice') instanceof UploadedFile) {
            $income->storeInvoice($request->file('invoice'));
        }
    }

    /**
     * What the form offers: the company's properties and how money can be received.
     *
     * @return array<string, mixed>
     */
    private function formOptions(Company $company): array
    {
        return [
            'currency' => $company->default_currency,
            'properties' => $company->properties()->orderBy('name')->get(['id', 'name', 'code']),
            'methods' => ExtraIncome::METHODS,
        ];
    }
}
