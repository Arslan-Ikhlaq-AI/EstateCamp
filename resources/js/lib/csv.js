/**
 * One CSV cell. Text that a spreadsheet would read as a formula (starting
 * with =, +, - or @) is prefixed with an apostrophe so it opens as text.
 */
function csvCell(value) {
    if (value === null || value === undefined) {
        return '';
    }

    let text = String(value);

    if (typeof value === 'string' && /^[=+\-@]/.test(text)) {
        text = `'${text}`;
    }

    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Save rows as a CSV file the browser downloads. The file starts with a
 * byte-order mark so Excel reads Arabic and accented names correctly.
 *
 * @param {string} filename
 * @param {Array<string>} header
 * @param {Array<Array<string|number|null>>} rows
 */
export function downloadCsv(filename, header, rows) {
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
