{{-- One labelled line of a details card, linked when given an `href`; the label stacks above the value on phones. --}}
@php($divider = ($first ?? false) ? '0' : '1px solid #e7ebf3')
<tr>
    <td class="ec-stack" width="38%" valign="top" style="padding: 11px 0; border-top: {{ $divider }}; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #7a829e;">{{ $label }}</td>
    <td class="ec-stack ec-stack-gap" valign="top" style="padding: 11px 0; border-top: {{ $divider }}; font-size: 15px; font-weight: 600; color: #0b1238; word-break: break-word;">
        @isset($href)
            <a href="{{ $href }}" target="_blank" style="color: #0b72a8; text-decoration: none;">{{ $value }}</a>
        @else
            {{ $value }}
        @endisset
    </td>
</tr>
