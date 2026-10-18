<?php

namespace App\Http\Requests;

use App\Http\Controllers\PropertyController;
use App\Models\Apartment;
use App\Models\HeadLease;
use App\Models\Landlord;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Models\Room;
use App\Models\Shop;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PropertyRequest extends FormRequest
{
    /**
     * How the required documents are named in error messages.
     *
     * @var array<string, string>
     */
    private const DOCUMENT_NAMES = [
        'tenancy_contract' => 'contract',
        'emirates_id' => 'Emirates ID',
        'trade_license' => 'trade licence',
        'passport' => 'passport',
    ];

    /**
     * Only members of a company can save properties, and only their own.
     * Another company's property answers 404 so its existence is not revealed.
     */
    public function authorize(): bool
    {
        $property = $this->route('property');

        if ($property instanceof Property && $property->company_id !== $this->user()->company_id) {
            throw new NotFoundHttpException;
        }

        return $this->user()->company_id !== null;
    }

    /**
     * The head lease terms entered with a leased property.
     */
    public const LEASE_TERMS = ['ejari_number', 'annual_rent', 'payments_per_year', 'security_deposit', 'notice_period_days'];

    /**
     * Landlord and lease details only apply to leased properties. A leased
     * property either picks one of the company's landlords (`existing`) or
     * brings the details of a new one (`new`).
     */
    protected function prepareForValidation(): void
    {
        if ($this->input('ownership_type') !== 'leased') {
            $this->merge([
                'landlord_mode' => null,
                'landlord_id' => null,
                'new_landlord' => null,
                'lease_start_date' => null,
                'lease_end_date' => null,
                ...array_fill_keys(self::LEASE_TERMS, null),
            ]);
        } elseif ($this->input('landlord_mode') === 'new') {
            $this->merge(['landlord_id' => null]);
        } else {
            $this->merge(['new_landlord' => null]);
        }

        if ($this->filled('country_code')) {
            $this->merge(['country_code' => strtoupper($this->input('country_code'))]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $property = $this->route('property');

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required', 'string', 'max:50',
                Rule::unique('properties')
                    ->where('company_id', $this->user()->company_id)
                    ->whereNull('deleted_at')
                    ->ignore($property),
            ],
            'property_type_id' => ['required', 'integer', Rule::exists('property_types', 'id')],
            'status' => ['required', Rule::in(PropertyController::STATUSES)],
            'cover_image' => ['nullable', 'image', 'max:5120'],

            'country_code' => ['required', 'regex:/^[A-Z]{2}$/'],
            'city' => ['nullable', 'string', 'max:255'],
            'area' => ['nullable', 'string', 'max:255'],
            'street' => ['nullable', 'string', 'max:255'],
            'building_name' => ['nullable', 'string', 'max:255'],
            'plot_number' => ['nullable', 'string', 'max:50'],
            'makani_number' => ['nullable', 'digits:10'],
            'po_box' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:1000'],
            'latitude' => ['nullable', 'required_with:longitude', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_with:latitude', 'numeric', 'between:-180,180'],
            'map_url' => ['nullable', 'url', 'max:2048'],

            'contact_person_name' => ['nullable', 'string', 'max:255'],
            'contact_person_phone' => ['nullable', 'string', 'max:40'],

            'ownership_type' => ['nullable', Rule::in(PropertyController::OWNERSHIP_TYPES)],
            'landlord_mode' => ['nullable', 'required_if:ownership_type,leased', Rule::in(['existing', 'new'])],
            'landlord_id' => [
                'nullable',
                'required_if:landlord_mode,existing',
                'integer',
                Rule::exists('landlords', 'id')
                    ->where('company_id', $this->user()->company_id)
                    ->whereNull('deleted_at'),
            ],
            'new_landlord' => ['nullable', 'array'],
            'new_landlord.landlord_type' => ['required_if:landlord_mode,new', Rule::in(Landlord::TYPES)],
            'new_landlord.name' => ['required_if:landlord_mode,new', 'nullable', 'string', 'max:255'],
            'new_landlord.contact_person_name' => ['nullable', 'string', 'max:255'],
            'new_landlord.phone' => ['nullable', 'string', 'max:40'],
            'new_landlord.email' => ['nullable', 'email', 'max:255'],
            'lease_start_date' => ['nullable', 'required_if:ownership_type,leased', 'date'],
            'lease_end_date' => ['nullable', 'required_if:ownership_type,leased', 'date', 'after:lease_start_date'],
            'ejari_number' => ['nullable', 'string', 'max:50'],
            'annual_rent' => ['nullable', 'required_if:ownership_type,leased', 'numeric', 'min:0', 'max:100000000'],
            'payments_per_year' => ['nullable', 'required_if:ownership_type,leased', 'integer', Rule::in(HeadLease::PAYMENTS_PER_YEAR)],
            'security_deposit' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'notice_period_days' => ['nullable', 'integer', 'between:0,730'],

            'notes' => ['nullable', 'string', 'max:5000'],

            'total_floors' => ['nullable', 'integer', 'between:1,200'],
            'total_units' => ['nullable', 'integer', 'between:1,10000'],

            'documents' => ['array', 'max:20'],
            'documents.*.id' => ['nullable', 'integer'],
            'documents.*.document_type' => ['required', Rule::in(PropertyDocument::TYPES)],
            'documents.*.title' => ['nullable', 'string', 'max:255'],
            'documents.*.document_number' => ['nullable', 'string', 'max:100'],
            'documents.*.file' => ['nullable', 'required_without:documents.*.id', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'documents.*.issued_on' => ['nullable', 'date'],
            'documents.*.expires_on' => ['nullable', 'date', 'after_or_equal:documents.*.issued_on'],
            'documents.*.notes' => ['nullable', 'string', 'max:2000'],

            ...$this->unitRules(),
        ];
    }

    /**
     * Rooms, shops and apartments added in batches: `count` alike units
     * numbered up from `first_number`, which must end in a digit.
     *
     * @return array<string, array<mixed>>
     */
    private function unitRules(): array
    {
        $batch = fn (string $kind) => [
            "units.{$kind}" => ['array', 'max:20'],
            "units.{$kind}.*.count" => ['required', 'integer', 'between:1,100'],
            "units.{$kind}.*.first_number" => ['required', 'string', 'max:25', 'regex:/\d$/'],
            "units.{$kind}.*.floor_number" => ['nullable', 'integer', 'between:-5,200'],
            "units.{$kind}.*.area_sqm" => ['nullable', 'numeric', 'gt:0', 'max:10000'],
        ];

        return [
            'units' => ['nullable', 'array'],
            ...$batch('rooms'),
            'units.rooms.*.room_type_id' => ['required', 'integer', Rule::exists('room_types', 'id')],
            'units.rooms.*.capacity' => ['required', 'integer', 'between:1,100'],
            'units.rooms.*.gender_policy' => ['nullable', Rule::in(Room::GENDER_POLICIES)],
            'units.rooms.*.rent_per_bed' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            ...$batch('shops'),
            'units.shops.*.shop_type' => ['nullable', Rule::in(Shop::TYPES)],
            'units.shops.*.monthly_rent' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            ...$batch('apartments'),
            'units.apartments.*.bedrooms' => ['required', 'integer', 'between:0,20'],
            'units.apartments.*.bathrooms' => ['required', 'integer', 'between:0,20'],
            'units.apartments.*.furnishing_status' => ['nullable', Rule::in(Apartment::FURNISHING_STATUSES)],
            'units.apartments.*.monthly_rent' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
        ];
    }

    /**
     * Every required document type must be listed, as a new upload or one of
     * the property's saved documents. Each batch's numbers must be free: not
     * used by a unit of the same kind already in the property, nor by an
     * earlier batch in this request. The property's units, saved and new,
     * must not outnumber its unit total. And a leased property's lease must
     * not overlap another of its leases.
     *
     * @return array<int, Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                $property = $this->route('property');
                $savedIds = $property instanceof Property ? $property->documents()->pluck('id')->all() : [];
                $listed = [];

                foreach ($this->input('documents', []) as $index => $document) {
                    if ($this->hasFile("documents.{$index}.file") || in_array((int) ($document['id'] ?? 0), $savedIds, true)) {
                        $listed[] = $document['document_type'] ?? null;
                    }
                }

                $missing = array_values(array_diff(PropertyDocument::REQUIRED_TYPES, $listed));

                if ($missing !== []) {
                    $names = array_map(fn (string $type) => self::DOCUMENT_NAMES[$type], $missing);
                    $validator->errors()->add('documents', 'Add the required documents: '.implode(', ', $names).'.');
                }
            },
            function (Validator $validator) {
                $property = $this->route('property');

                $isLeased = $this->input('ownership_type') === 'leased';

                if (! $property instanceof Property || ! $isLeased || $validator->errors()->hasAny(['lease_start_date', 'lease_end_date'])) {
                    return;
                }

                $current = $property->currentLease();
                $overlapping = $property->headLeases()
                    ->when($current, fn ($query) => $query->whereKeyNot($current->id))
                    ->whereNot('status', 'terminated')
                    ->whereDate('start_date', '<=', $this->date('lease_end_date'))
                    ->whereDate('end_date', '>=', $this->date('lease_start_date'))
                    ->first();

                if ($overlapping) {
                    $validator->errors()->add('lease_start_date', "These dates overlap lease {$overlapping->lease_number} from {$overlapping->start_date->format('j M Y')} to {$overlapping->end_date->format('j M Y')}.");
                }
            },
            function (Validator $validator) {
                $hasUnitErrors = collect($validator->errors()->keys())
                    ->contains(fn (string $key) => str_starts_with($key, 'units') || $key === 'total_units');

                if ($hasUnitErrors) {
                    return;
                }

                $property = $this->route('property');
                $kinds = [
                    'rooms' => ['column' => 'room_number', 'label' => 'Room'],
                    'shops' => ['column' => 'shop_number', 'label' => 'Shop'],
                    'apartments' => ['column' => 'apartment_number', 'label' => 'Apartment'],
                ];

                foreach ($kinds as $kind => ['column' => $column, 'label' => $label]) {
                    $taken = $property instanceof Property
                        ? $property->{$kind}()->pluck($column)->map(fn (string $number) => mb_strtolower($number))->all()
                        : [];

                    foreach ($this->input("units.{$kind}", []) as $index => $batch) {
                        $numbers = Property::unitNumbers($batch['first_number'], (int) $batch['count']);
                        $clash = collect($numbers)->first(fn (string $number) => in_array(mb_strtolower($number), $taken, true));

                        if ($clash !== null) {
                            $validator->errors()->add("units.{$kind}.{$index}.first_number", "{$label} {$clash} already exists in this property.");
                        }

                        $taken = [...$taken, ...array_map('mb_strtolower', $numbers)];
                    }
                }

                $totalUnits = $this->integer('total_units');

                if ($totalUnits > 0) {
                    $adding = collect($this->input('units', []))
                        ->flatten(1)
                        ->sum(fn (array $batch) => (int) $batch['count']);
                    $planned = ($property instanceof Property ? $property->unitCount() : 0) + $adding;

                    if ($planned > $totalUnits) {
                        $validator->errors()->add('total_units', "The property holds {$totalUnits} units, but it would have {$planned} rooms, shops and apartments.");
                    }
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'documents.*.file.required_without' => 'Upload the file.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'property_type_id' => 'property type',
            'landlord_id' => 'landlord',
            'new_landlord.landlord_type' => 'landlord type',
            'new_landlord.name' => 'landlord name',
            'new_landlord.contact_person_name' => 'contact person',
            'new_landlord.phone' => 'landlord phone',
            'new_landlord.email' => 'landlord email',
            'makani_number' => 'Makani number',
            'documents.*.document_type' => 'document type',
            'documents.*.file' => 'file',
            'documents.*.expires_on' => 'expiry date',
            'documents.*.issued_on' => 'issue date',
            'annual_rent' => 'annual rent',
            'payments_per_year' => 'payments a year',
            'notice_period_days' => 'notice period',
            'total_floors' => 'number of floors',
            'total_units' => 'number of units',
            'units.*.*.count' => 'how many',
            'units.*.*.first_number' => 'first number',
            'units.rooms.*.room_type_id' => 'room type',
            'units.rooms.*.capacity' => 'beds per room',
        ];
    }
}
