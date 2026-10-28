/**
 * VAT on a shop's rent; homes are exempt. Matches ContractLine::SHOP_VAT_RATE.
 */
const SHOP_VAT_RATE = 5;

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * The unit a line rents, from the form's property options.
 */
function unitOf(line, properties) {
    const property = properties.find((item) => item.id === line.property_id);

    return {
        bed: property?.rooms.find((room) => room.id === line.room_id),
        room: property?.rooms.find((room) => room.id === line.room_id),
        apartment: property?.apartments.find((apartment) => apartment.id === line.apartment_id),
        shop: property?.shops.find((shop) => shop.id === line.shop_id),
    }[line.unit_type];
}

/**
 * A line's list price for a month: a whole room at its bed rate for every
 * bed, beds at that rate each, an apartment or shop at its rent. Null when
 * the unit has none. Matches ContractLine::standardRent().
 */
export function standardRent(line, properties) {
    const unit = unitOf(line, properties);

    if (!unit || unit.rate === null || unit.rate === undefined) {
        return null;
    }

    return {
        room: unit.rate * unit.capacity,
        bed: unit.rate * (Number(line.quantity) || 0),
    }[line.unit_type] ?? unit.rate;
}

/**
 * The list price of every line together, or null when any unit has none.
 */
export function standardTotal(lines, properties) {
    const rents = lines.map((line) => standardRent(line, properties));

    return rents.length > 0 && rents.every((rent) => rent !== null) ? round2(rents.reduce((sum, rent) => sum + rent, 0)) : null;
}

/**
 * The lines with the contract's monthly rent shared between them, the way
 * ContractLine::shareRent() does it on save: in proportion to their list
 * prices when every unit has one, otherwise equally, the last line taking
 * what rounding leaves. New lines rent one unit, with VAT on a shop.
 */
export function shareRent(lines, monthlyRent, properties) {
    const total = Number(monthlyRent) || 0;
    let weights = lines.map((line) => standardRent(line, properties));

    if (weights.some((weight) => weight === null || weight <= 0)) {
        weights = lines.map(() => 1);
    }

    const sum = weights.reduce((acc, weight) => acc + weight, 0);
    let left = total;

    return lines.map((line, index) => {
        const share = index === lines.length - 1 ? round2(left) : round2((total * weights[index]) / sum);
        const quantity = Number(line.quantity) || 1;
        left -= share;

        return {
            ...line,
            quantity,
            monthly_rate: round2(share / quantity),
            vat_rate: line.vat_rate ?? (line.unit_type === 'shop' ? SHOP_VAT_RATE : 0),
        };
    });
}
