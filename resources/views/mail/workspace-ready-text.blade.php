{{ $company->name }} is live on {{ config('app.name') }}

Welcome aboard. Your workspace for {{ $company->legal_name ?: $company->name }} is set up and ready to use.

Workspace: {{ $company->workspaceUrl() }}
@if ($businessType)
Business: {{ $businessType }}
@endif
Currency: {{ $company->default_currency }}
Time zone: {{ str_replace('_', ' ', $company->timezone) }}
Super admin: {{ $company->contact_person_name }}
@if ($company->terms_accepted_at)
Terms of Service accepted: version {{ $company->terms_version }}, on {{ $company->terms_accepted_at->timezone($company->timezone)->format('j M Y, H:i') }} ({{ route('terms') }})
@endif

Who can sign in
(Each person has their own email with their sign-in details. Passwords are never included in this summary.)
@foreach ($users as $person)
- {{ $person['name'] }} <{{ $person['email'] }}>, {{ $person['role'] }}
@endforeach

Open your workspace: {{ $company->workspaceUrl() }}

You are receiving this because {{ $company->email }} was given as the company email for {{ $company->name }}.
