<?php

namespace App\Http\Controllers;

use App\Http\Requests\CompanyProfileRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The signed-in company's own profile: who it is, how to reach it, where it
 * is and how it bills. Its status and expiry are set by the platform.
 */
class CompanyProfileController extends Controller
{
    /**
     * Currencies offered first; any three-letter code is accepted.
     */
    private const CURRENCIES = ['AED', 'SAR', 'QAR', 'OMR', 'BHD', 'KWD', 'USD', 'EUR', 'GBP', 'INR', 'PKR'];

    /**
     * Time zones offered first; any valid zone is accepted.
     */
    private const TIMEZONES = ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Muscat', 'Asia/Bahrain', 'Asia/Kuwait', 'Asia/Karachi', 'Asia/Kolkata', 'Europe/London', 'UTC'];

    /**
     * Show the company profile with its figures.
     */
    public function edit(Request $request): Response
    {
        $company = $this->currentCompany($request);

        return Inertia::render('Configuration/Company', [
            'company' => [
                ...$company->only([
                    'name', 'legal_name', 'short_name', 'description', 'logo_url', 'website',
                    'trade_license_number', 'tax_registration_number', 'email', 'phone',
                    'contact_person_name', 'contact_person_phone', 'contact_person_email',
                    'address_line_1', 'address_line_2', 'city', 'state', 'postal_code', 'country_code',
                    'default_currency', 'timezone', 'status',
                ]),
                'expiry_date' => $company->expiry_date?->toDateString(),
                'created_at' => $company->created_at?->toDateString(),
            ],
            'figures' => [
                'properties' => $company->properties()->count(),
                'rooms' => $company->rooms()->count(),
                'clients' => $company->clients()->count(),
                'contracts' => $company->contracts()->where('status', 'active')->count(),
                'users' => $company->users()->count(),
            ],
            'currencies' => array_values(array_unique([...self::CURRENCIES, $company->default_currency])),
            'timezones' => array_values(array_unique([...self::TIMEZONES, $company->timezone])),
        ]);
    }

    /**
     * Save the profile, storing a new logo or removing the current one.
     */
    public function update(CompanyProfileRequest $request): RedirectResponse
    {
        $company = $this->currentCompany($request);
        $attributes = $request->safe()->except(['logo', 'remove_logo']);

        if ($request->hasFile('logo')) {
            $attributes['logo_url'] = '/storage/'.$request->file('logo')->store("companies/{$company->id}", 'public');
        } elseif ($request->boolean('remove_logo')) {
            $attributes['logo_url'] = null;
        }

        $company->update($attributes);

        return to_route('configuration.company')->with('success', 'The company profile was saved.');
    }
}
