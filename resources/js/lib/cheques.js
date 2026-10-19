import { addMonths, todayIso } from '@/hooks/use-leasing-format';

/**
 * Cheque schedules worked out in the browser the same way the server does
 * (Cheque::periods(), Cheque::currentYear() and each agreement's
 * plannedCheques()), so the forms show the real schedule as the terms change.
 */

export const CYCLE_MONTHS = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };

export const chequeKey = (purpose, sequence) => `${purpose}:${sequence}`;

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * `days` after a YYYY-MM-DD date (negative for before).
 */
export function addDays(isoDate, days) {
    const [year, month, day] = isoDate.split('-').map(Number);

    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * Months from `from` up to (not including) `to`: whole months, then the rest
 * as a share of the month it falls in.
 */
export function monthsBetween(from, to) {
    let whole = 0;

    while (whole < 1200 && addMonths(from, whole + 1) <= to) {
        whole++;
    }

    const anchor = addMonths(from, whole);

    if (anchor >= to) {
        return whole;
    }

    const [year, month] = anchor.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86400000;

    return whole + days / daysInMonth;
}

/**
 * One period every `months` months from `start`, the last cut short at
 * `end`. Chained periods start the day after the previous one ends (as
 * invoices do); anchored ones start `months` apart from `start`.
 */
export function chequePeriods(start, end, months, chained = true) {
    if (!start || !end || end < start || !months) {
        return [];
    }

    const periods = [];
    let from = start;

    for (let index = 1; index <= 600 && from <= end; index++) {
        const next = chained ? addMonths(from, months) : addMonths(start, months * index);
        const to = addDays(next, -1);

        periods.push({ start: from, end: to > end ? end : to });
        from = next;
    }

    return periods;
}

/**
 * The agreement year today falls in; its cheques (and earlier ones) are needed now.
 */
export function currentChequeYear(start, end, today = todayIso()) {
    if (!start || !end) {
        return null;
    }

    let yearStart = start;

    while (addMonths(yearStart, 12) <= today && addMonths(yearStart, 12) <= end) {
        yearStart = addMonths(yearStart, 12);
    }

    const yearEnd = addDays(addMonths(yearStart, 12), -1);

    return { start: yearStart, end: yearEnd > end ? end : yearEnd };
}

/**
 * Which agreement year (0 for the first) a date falls in.
 */
export function agreementYear(start, date) {
    let year = 0;

    while (year < 100 && addMonths(start, 12 * (year + 1)) <= date) {
        year++;
    }

    return year;
}

function withDeposit(plan, { start_date, security_deposit }) {
    const deposit = Number(security_deposit) || 0;

    return deposit > 0
        ? [{ key: chequeKey('security_deposit', 1), purpose: 'security_deposit', sequence: 1, periodStart: null, periodEnd: null, chequeDate: start_date, amount: round2(deposit) }, ...plan]
        : plan;
}

/**
 * A client contract's cheques: the deposit, then one per billing period,
 * each for what the period's invoice should come to.
 */
export function planContractCheques(data) {
    const { start_date, end_date, billing_cycle, lines } = data;
    const months = CYCLE_MONTHS[billing_cycle];

    if (!start_date || !end_date || end_date <= start_date || !months) {
        return [];
    }

    const rent = chequePeriods(start_date, end_date, months, true)
        .map((period, index) => {
            let total = 0;

            for (const line of lines) {
                const lineStart = line.start_date || start_date;
                const lineEnd = line.end_date || end_date;
                const from = lineStart > period.start ? lineStart : period.start;
                const to = lineEnd < period.end ? lineEnd : period.end;

                if (from > to) {
                    continue;
                }

                const amount = round2((Number(line.monthly_rate) || 0) * monthsBetween(from, addDays(to, 1))) * (Number(line.quantity) || 0);
                total += amount + round2((amount * (Number(line.vat_rate) || 0)) / 100);
            }

            return {
                key: chequeKey('rent', index + 1),
                purpose: 'rent',
                sequence: index + 1,
                periodStart: period.start,
                periodEnd: period.end,
                chequeDate: period.start,
                amount: round2(total),
            };
        })
        .filter((row) => row.amount > 0);

    return withDeposit(rent, data);
}

/**
 * A head lease's cheques to the landlord: the deposit, then an equal share
 * of the annual rent every 12 / payments-per-year months.
 */
export function planLeaseCheques(data) {
    const { start_date, end_date, annual_rent, payments_per_year } = data;
    const perYear = Number(payments_per_year);
    const rent = Number(annual_rent);

    if (!start_date || !end_date || end_date <= start_date || !perYear || !rent) {
        return [];
    }

    const amount = round2(rent / perYear);
    const rows = chequePeriods(start_date, end_date, 12 / perYear, false).map((period, index) => ({
        key: chequeKey('rent', index + 1),
        purpose: 'rent',
        sequence: index + 1,
        periodStart: period.start,
        periodEnd: period.end,
        chequeDate: period.start,
        amount,
    }));

    return withDeposit(rows, data);
}

export const emptyChequeEntry = () => ({
    id: null,
    status: 'pending',
    locked: false,
    cheque_date: '',
    amount: '',
    cheque_number: '',
    bank_name: '',
    account_holder: '',
    front_image: null,
    back_image: null,
    remove_front_image: false,
    remove_back_image: false,
    front_image_url: null,
    back_image_url: null,
});

/**
 * The form's entries for stored cheques, keyed by place in the schedule. A
 * date or amount that matches the plan is left blank so it keeps following
 * the terms.
 */
export function initialChequeEntries(cheques = [], plan = []) {
    const planned = Object.fromEntries(plan.map((row) => [row.key, row]));

    return Object.fromEntries(
        cheques.map((cheque) => {
            const row = planned[cheque.key];

            return [
                cheque.key,
                {
                    ...emptyChequeEntry(),
                    id: cheque.id,
                    status: cheque.status,
                    locked: cheque.locked,
                    cheque_date: row?.chequeDate === cheque.cheque_date ? '' : cheque.cheque_date,
                    amount: row && Math.abs(row.amount - cheque.amount) < 0.005 ? '' : String(cheque.amount),
                    cheque_number: cheque.cheque_number ?? '',
                    bank_name: cheque.bank_name ?? '',
                    account_holder: cheque.account_holder ?? '',
                    front_image_url: cheque.front_image_url,
                    back_image_url: cheque.back_image_url,
                },
            ];
        }),
    );
}

/**
 * The rows the form shows: the plan merged with what was entered. Once a
 * cheque has reached the bank the server keeps the stored schedule, so the
 * stored cheques are shown instead of the plan.
 */
export function scheduleRows(plan, entries, stored = [], isKept = false) {
    const base = isKept
        ? stored.map((cheque) => ({
              key: cheque.key,
              purpose: cheque.purpose,
              sequence: cheque.sequence,
              periodStart: cheque.period_start,
              periodEnd: cheque.period_end,
              chequeDate: cheque.cheque_date,
              amount: cheque.amount,
          }))
        : plan;

    return base.map((row) => {
        const entry = entries[row.key] ?? emptyChequeEntry();

        return {
            ...row,
            entry,
            chequeDate: entry.cheque_date || row.chequeDate,
            amount: entry.amount !== '' && entry.amount !== null ? Number(entry.amount) : row.amount,
            locked: entry.locked,
        };
    });
}

/**
 * What the form sends: one entry per cheque still to present, in order.
 */
export function chequePayload(rows) {
    return rows
        .filter((row) => !row.locked)
        .map((row) => ({
            key: row.key,
            cheque_date: row.chequeDate,
            amount: row.amount,
            cheque_number: row.entry.cheque_number,
            bank_name: row.entry.bank_name,
            account_holder: row.entry.account_holder,
            front_image: row.entry.front_image,
            back_image: row.entry.back_image,
            remove_front_image: row.entry.remove_front_image,
            remove_back_image: row.entry.remove_back_image,
        }));
}

/**
 * Whether a row's cheque is in hand with everything this year needs.
 */
export function isChequeReady(row) {
    const { entry } = row;
    const hasFront = Boolean(entry.front_image) || (Boolean(entry.front_image_url) && !entry.remove_front_image);

    return row.locked || (Boolean(entry.cheque_number?.trim()) && Boolean(entry.bank_name?.trim()) && hasFront);
}
