{{--
    The frame every EstateCamp email shares: a navy hero with the brand
    lockup, eyebrow and headline, then a white body and a quiet footer.
    Tables and inline styles keep it intact in Gmail, Outlook and Apple Mail.
--}}
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>@yield('title')</title>
    <style>
        @media (max-width: 620px) {
            .ec-card { width: 100% !important; border-radius: 0 !important; }
            .ec-pad { padding-left: 24px !important; padding-right: 24px !important; }
            .ec-headline { font-size: 26px !important; }
            .ec-stack { display: block !important; width: 100% !important; text-align: left !important; padding: 0 !important; }
            .ec-stack-gap { padding-top: 6px !important; }
        }
        a { color: #0b72a8; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #eef2f8; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">@yield('preheader')&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #eef2f8;">
        <tr>
            <td align="center" style="padding: 32px 12px;">
                <table role="presentation" class="ec-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 18px 40px -18px rgba(11, 18, 56, 0.28);">
                    <tr>
                        <td class="ec-pad" bgcolor="#000851" style="padding: 34px 40px 40px; background-color: #000851; background-image: radial-gradient(110% 120% at 100% 0%, rgba(28, 181, 224, 0.5) 0%, rgba(28, 181, 224, 0) 58%), linear-gradient(160deg, #000c66 0%, #000851 55%, #00063d 100%);">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td width="38" height="38" align="center" valign="middle" bgcolor="#1cb5e0" style="width: 38px; height: 38px; border-radius: 11px; background-color: #1cb5e0; background-image: linear-gradient(140deg, #1cb5e0 0%, #000851 100%); color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; line-height: 38px;">&#9650;</td>
                                    <td style="padding-left: 12px; font-family: 'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff;">Estate<span style="color: #1cb5e0;">Camp</span></td>
                                </tr>
                            </table>

                            <p style="margin: 34px 0 10px; font-family: 'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #7fd8f2;">@yield('eyebrow')</p>
                            <h1 class="ec-headline" style="margin: 0; font-family: 'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 30px; line-height: 1.22; font-weight: 600; letter-spacing: -0.02em; color: #ffffff;">@yield('headline')</h1>
                        </td>
                    </tr>
                    <tr>
                        <td height="4" bgcolor="#f5b415" style="height: 4px; font-size: 0; line-height: 0; background-color: #f5b415; background-image: linear-gradient(90deg, #1cb5e0 0%, #f8e1a0 55%, #f5b415 100%);">&nbsp;</td>
                    </tr>
                    <tr>
                        <td class="ec-pad" style="padding: 36px 40px 40px; font-family: 'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.65; color: #3a4366;">
                            @yield('content')
                        </td>
                    </tr>
                </table>

                <table role="presentation" class="ec-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px;">
                    <tr>
                        <td class="ec-pad" align="center" style="padding: 24px 40px 8px; font-family: 'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.7; color: #7a829e;">
                            @yield('footer')
                            <br>
                            &copy; {{ date('Y') }} {{ config('app.name') }}. Property, leasing and staff accommodation, in one workspace.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
