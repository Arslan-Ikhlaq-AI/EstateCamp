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
        room: property?.rooms.find((room) => room.id === line.room_id),
        apartment: property?.apartments.find((apartment) => apartment.id === line.apartment_id),
        shop: property?.shops.find((shop) => shop.id === line.shop_id),
    }[line.unit_type];
}

/**
 * A line's list price for a month: the room's, apartment's or shop's rent.
 * Null when the unit has none. Matches ContractLine::standardRent().
 */
export function standardRent(line, properties) {
    const unit = unitOf(line, properties);

    return unit?.rate ?? null;
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
        left -= share;

        return {
            ...line,
            monthly_rate: share,
            vat_rate: line.vat_rate ?? (line.unit_type === 'shop' ? SHOP_VAT_RATE : 0),
        };
    });
}
