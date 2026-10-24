@extends('mail.layout')

@php
    $country = class_exists(Locale::class) ? Locale::getDisplayRegion('-'.$company->country_code, 'en') : $company->country_code;
    $steps = [
        ['Add your properties and rooms', 'Set up each building with its floors, rooms, beds, apartments and shops.'],
        ['Bring in clients and contracts', 'Record who rents from you, schedule their cheques and send invoices.'],
        ['Run the day to day', 'Track maintenance, contractor visits, staff attendance and payroll in one place.'],
    ];
@endphp

@section('title', "{$company->name} is live")

@section('preheader', "Your {$company->name} workspace is ready, with ".trans_choice('{1} one user|[2,*] :count users', $users->count()).' set up.')

@section('eyebrow', 'Workspace ready')

@section('headline')
    {{ $company->name }}
    <span style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; color: #f8e1a0;">is live.</span>
@endsection

@section('content')
    <p style="margin: 0 0 16px;">Welcome aboard,</p>
    <p style="margin: 0 0 26px;">
        Your {{ config('app.name') }} workspace for <strong style="color: #0b1238;">{{ $company->legal_name ?: $company->name }}</strong> is set up and ready to use.
        Here is a summary of what was created, for your records.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f6f8fc; border: 1px solid #e0e4ed; border-radius: 16px;">
        <tr>
            <td style="padding: 8px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    @include('mail.partials.detail-row', ['first' => true, 'label' => 'Workspace', 'value' => Str::after($company->workspaceUrl(), '://'), 'href' => $company->workspaceUrl()])
                    @if ($businessType)
                        @include('mail.partials.detail-row', ['label' => 'Business', 'value' => $businessType])
                    @endif
                    @include('mail.partials.detail-row', ['label' => 'Location', 'value' => $company->city ? "{$company->city}, {$country}" : $country])
                    @include('mail.partials.detail-row', ['label' => 'Currency', 'value' => $company->default_currency])
                    @include('mail.partials.detail-row', ['label' => 'Time zone', 'value' => str_replace('_', ' ', $company->timezone)])
                    @include('mail.partials.detail-row', ['label' => 'Super admin', 'value' => $company->contact_person_name])
                </table>
            </td>
        </tr>
    </table>

    <h2 style="margin: 34px 0 6px; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: #0b1238;">Who can sign in</h2>
    <p style="margin: 0 0 14px; font-size: 14px; color: #5b6482;">Each person has their own email with their sign-in details. Passwords are never included in this summary.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e0e4ed; border-radius: 16px;">
        @foreach ($users as $person)
            <tr>
                <td style="padding: 14px 18px; {{ $loop->first ? '' : 'border-top: 1px solid #e7ebf3;' }}">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td width="40" valign="middle" style="width: 40px;">
                                <div style="width: 36px; height: 36px; border-radius: 18px; background-color: #000851; background-image: linear-gradient(140deg, #1cb5e0 0%, #000851 100%); color: #ffffff; font-size: 13px; font-weight: 700; line-height: 36px; text-align: center;">{{ Str::upper(collect(explode(' ', $person['name']))->filter()->take(2)->map(fn ($part) => Str::substr($part, 0, 1))->implode('')) }}</div>
                            </td>
                            <td valign="middle" style="padding-left: 12px;">
                                <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0b1238;">{{ $person['name'] }}</p>
                                <p style="margin: 0; font-size: 13px; color: #5b6482; word-break: break-all;">{{ $person['email'] }}</p>
                            </td>
                            <td align="right" valign="middle" style="padding-left: 8px; white-space: nowrap;">
                                <span style="display: inline-block; padding: 5px 11px; border-radius: 999px; background-color: {{ $loop->first ? '#fff3cf' : '#e6f6fc' }}; font-size: 12px; font-weight: 700; color: {{ $loop->first ? '#8a5a00' : '#0b72a8' }};">{{ $person['role'] }}</span>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        @endforeach
    </table>

    <h2 style="margin: 34px 0 14px; font-size: 17px; font-weight: 700; letter-spacing: -0.01em; color: #0b1238;">Your first steps</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        @foreach ($steps as [$title, $description])
            <tr>
                <td width="40" valign="top" style="width: 40px; padding: 0 0 16px;">
                    <div style="width: 28px; height: 28px; border-radius: 9px; background-color: #e6f6fc; color: #0b72a8; font-size: 13px; font-weight: 800; line-height: 28px; text-align: center;">{{ $loop->iteration }}</div>
                </td>
                <td valign="top" style="padding: 2px 0 16px 4px;">
                    <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0b1238;">{{ $title }}</p>
                    <p style="margin: 2px 0 0; font-size: 14px; color: #5b6482;">{{ $description }}</p>
                </td>
            </tr>
        @endforeach
    </table>

    @include('mail.partials.button', ['url' => $company->workspaceUrl(), 'label' => 'Open your workspace'])
@endsection

@section('footer')
    You are receiving this because {{ $company->email }} was given as the company email for {{ $company->name }} on {{ config('app.name') }}.
@endsection
