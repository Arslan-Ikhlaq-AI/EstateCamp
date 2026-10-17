import { useTranslation } from '@/hooks/use-translation';

/**
 * Today as YYYY-MM-DD in the browser's own time zone (toISOString would give
 * the UTC date, a day off near midnight in Dubai).
 */
export function todayIso() {
    const now = new Date();

    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * `months` after a YYYY-MM-DD date, keeping the day but never spilling into
 * the next month (31 Jan + 1 month = 28 or 29 Feb), like Carbon's
 * addMonthsNoOverflow on the server.
 */
export function addMonths(isoDate, months) {
    const [year, month, day] = isoDate.split('-').map(Number);
    const target = new Date(Date.UTC(year, month - 1 + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();

    target.setUTCDate(Math.min(day, lastDay));

    return target.toISOString().slice(0, 10);
}

/**
 * Wording shared by the leasing pages: what a contract line rents, a date
 * range, and a contract's units in one line.
 */
export function useLeasingFormat() {
    const { t, formatDate } = useTranslation();

    /**
     * "8 beds in room 101", "Whole room 103", "Apartment B-401" or "Shop G-01".
     */
    const lineLabel = (line) => {
        switch (line.unitType) {
            case 'bed':
                return line.roomNumber
                    ? t('leasing.lines.bedsInRoom', { count: line.quantity, room: line.roomNumber })
                    : t('leasing.lines.beds', { count: line.quantity });
            case 'room':
                return t('leasing.lines.room', { room: line.roomNumber });
            case 'apartment':
                return t('leasing.lines.apartment', { number: line.apartmentNumber });
            case 'shop':
                return t('leasing.lines.shop', { number: line.shopNumber });
            default:
                return '';
        }
    };

    const period = (start, end) => `${formatDate(start)} – ${formatDate(end)}`;

    /**
     * "16 beds · 1 apartment" for a contract's `units` counts.
     */
    const unitsSummary = (units) =>
        [
            units.beds > 0 && t('leasing.units.beds', { count: units.beds }),
            units.rooms > 0 && t('leasing.units.rooms', { count: units.rooms }),
            units.apartments > 0 && t('leasing.units.apartments', { count: units.apartments }),
            units.shops > 0 && t('leasing.units.shops', { count: units.shops }),
        ]
            .filter(Boolean)
            .join(' · ');

    return { lineLabel, period, unitsSummary };
}
