Your sign-in for {{ $company->name }} on {{ config('app.name') }}

Hi {{ $user->name }},

{{ $company->name }} now runs on {{ config('app.name') }}, and you have been added as {{ $role->name }}. Use these details to sign in:

Workspace: {{ $company->workspaceUrl() }}
Email: {{ $user->email }}
{{ $isGenerated ? 'Temporary password' : 'Password' }}: {{ $password }}
Role: {{ $role->name }}, {{ Str::lcfirst($role->description) }}

@if ($isGenerated)
Keep your account safe: this password was created for you, so change it after you first sign in (open your profile from the menu and choose Update password).
@else
Keep your account safe: this is the password set when {{ $company->name }} signed up. You can change it any time from your profile (Update password).
@endif
Delete this email once you have signed in. {{ config('app.name') }} will never ask for your password by email or phone.

Not expecting this? Let {{ $company->email }} know.
