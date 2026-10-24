Your sign-in for {{ $company->name }} on {{ config('app.name') }}

Hi {{ $user->name }},

{{ $company->name }} now runs on {{ config('app.name') }}, and you have been added as {{ $role->name }}. Use these details to sign in:

Workspace: {{ $company->workspaceUrl() }}
Email: {{ $user->email }}
Temporary password: {{ $password }}
Role: {{ $role->name }}, {{ Str::lcfirst($role->description) }}

Keep your account safe: change this password after you first sign in (open your profile from the menu and choose Update password). {{ config('app.name') }} will never ask for your password by email or phone.

Not expecting this? Let {{ $company->email }} know.
