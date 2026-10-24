<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" href="/favicon.svg" type="image/svg+xml">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600|plus-jakarta-sans:400,500,600,700,800|instrument-serif:400i|ibm-plex-sans-arabic:400,500,600,700&display=swap" rel="stylesheet" />

        @unless (Str::startsWith($page['component'], ['Auth/', 'Onboarding/', 'Legal/']))
            {{-- Applies the saved theme and language before the first paint so app pages never flash. --}}
            <script>
                (function () {
                    try {
                        var appearance = localStorage.getItem('estatecamp.appearance') || 'system';
                        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        document.documentElement.classList.toggle('dark', appearance === 'dark' || (appearance === 'system' && prefersDark));

                        if (localStorage.getItem('estatecamp.locale') === 'ar') {
                            document.documentElement.lang = 'ar';
                            document.documentElement.dir = 'rtl';
                        }
                    } catch (error) {}
                })();
            </script>
        @endunless

        <!-- Scripts -->
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
