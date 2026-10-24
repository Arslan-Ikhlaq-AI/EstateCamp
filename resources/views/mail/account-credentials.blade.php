@extends('mail.layout')

@section('title', "Your sign-in for {$company->name}")

@section('preheader', "{$company->name} is ready for you on ".config('app.name').'. Here are your sign-in details.')

@section('eyebrow', 'Your sign-in details')

@section('headline')
    Welcome to {{ $company->name }},
    <span style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; color: #f8e1a0;">{{ Str::before($user->name, ' ') }}.</span>
@endsection

@section('content')
    <p style="margin: 0 0 16px;">Hi {{ $user->name }},</p>
    <p style="margin: 0 0 26px;">
        {{ $company->name }} now runs on {{ config('app.name') }}, and you have been added as
        <strong style="color: #0b1238;">{{ $role->name }}</strong>. Use the details below to sign in to your workspace.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f6f8fc; border: 1px solid #e0e4ed; border-radius: 16px;">
        <tr>
            <td style="padding: 8px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    @include('mail.partials.detail-row', ['first' => true, 'label' => 'Workspace', 'value' => Str::after($company->workspaceUrl(), '://'), 'href' => $company->workspaceUrl()])
                    @include('mail.partials.detail-row', ['label' => 'Email', 'value' => $user->email])
                    @include('mail.partials.detail-row', ['label' => 'Role', 'value' => $role->name])
                </table>
            </td>
        </tr>
        <tr>
            <td style="padding: 0 24px 24px;">
                <p style="margin: 6px 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #7a829e;">Temporary password</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding: 16px 18px; background-color: #ffffff; border: 1px dashed #1cb5e0; border-radius: 12px; font-family: 'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.12em; color: #000851;">{{ $password }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <p style="margin: 18px 0 0; font-size: 14px; color: #5b6482;">{{ $role->description }}</p>

    @include('mail.partials.button', ['url' => $company->workspaceUrl(), 'label' => 'Sign in to '.($company->short_name ?: $company->name)])

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 26px; background-color: #fff8e6; border: 1px solid #f8e1a0; border-radius: 14px;">
        <tr>
            <td style="padding: 16px 20px; font-size: 14px; line-height: 1.6; color: #6b4a00;">
                <strong style="color: #8a5a00;">Keep your account safe.</strong>
                Change this password after you first sign in: open your profile from the menu and choose <em>Update password</em>.
                {{ config('app.name') }} will never ask for your password by email or phone.
            </td>
        </tr>
    </table>
@endsection

@section('footer')
    You are receiving this because {{ $company->name }} added {{ $user->email }} to its {{ config('app.name') }} workspace.
    Not expecting it? Let {{ $company->email }} know.
@endsection
