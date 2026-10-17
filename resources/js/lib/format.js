const numberFormat = new Intl.NumberFormat();
const shortDateFormat = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
});
const mediumDateFormat = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
});

export const formatNumber = (value) => numberFormat.format(value);

// Day strings (`2026-10-09`) come from the server without a time zone, so they
// are parsed as local midnight to avoid shifting to the previous day.
const parseDay = (day) => new Date(`${day}T00:00:00`);

export const formatShortDay = (day) => shortDateFormat.format(parseDay(day));

export const formatMediumDay = (day) => mediumDateFormat.format(parseDay(day));

export const formatMediumDateTime = (isoString) =>
    mediumDateFormat.format(new Date(isoString));

export function getInitials(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
}
