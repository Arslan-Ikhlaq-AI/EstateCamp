{{-- The company the email is about: its logo beside its name. --}}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 26px;">
    <tr>
        @if ($company->logo_url)
            <td width="58" height="58" align="center" valign="middle" style="width: 58px; height: 58px; border: 1px solid #e0e4ed; border-radius: 14px; background-color: #ffffff;">
                <img src="{{ url($company->logo_url) }}" width="44" height="44" alt="{{ $company->name }}" style="display: block; width: 44px; height: 44px; border: 0; object-fit: contain;">
            </td>
        @endif
        <td valign="middle" style="padding-left: {{ $company->logo_url ? '14px' : '0' }};">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: #0b1238;">{{ $company->name }}</p>
            <p style="margin: 2px 0 0; font-size: 13px; color: #5b6482;">{{ Str::after($company->workspaceUrl(), '://') }}</p>
        </td>
    </tr>
</table>
