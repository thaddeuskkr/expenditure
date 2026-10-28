// Shared receipt calculation. Money stays in integer currency minor units.
const MAX_AMOUNT = 99999999999;

function object(value, keys, label) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => keys.indexOf(key) < 0))
        throw new Error(`Use valid ${label} fields.`);
}

function integer(value, min, max, label) {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Enter a valid ${label}.`);
    return value;
}

// Quotient and remainder of a*b/d without unsafe intermediate products or BigInt
// (PocketBase's JavaScript runtime does not support BigInt).
function product(a, b, d) {
    let quotient = 0, remainder = 0;
    let part = Math.floor(a / d), rest = a % d;
    while (b > 0) {
        if (b % 2 === 1) {
            quotient += part;
            remainder += rest;
            if (remainder >= d) {
                quotient++;
                remainder -= d;
            }
        }

        b = Math.floor(b / 2);
        if (b) {
            part *= 2;
            rest *= 2;
            if (rest >= d) {
                part++;
                rest -= d;
            }
        }
    }

    return { quotient, remainder };
}

function rounded(a, b, d) {
    const value = product(a, b, d);
    return value.quotient + (value.remainder * 2 >= d ? 1 : 0);
}

function distribute(total, rows) {
    const weight = rows.reduce((sum, row) => sum + row.weight, 0);
    if (!weight && total) throw new Error("Charges need a positive item subtotal.");
    const allocations = rows.map((row) => {
        const result = weight ? product(Math.abs(total), row.weight, weight) : { quotient: 0, remainder: 0 };
        return { member: row.member, amount: result.quotient, remainder: result.remainder };
    });
    let remaining = Math.abs(total) - allocations.reduce((sum, row) => sum + row.amount, 0);
    allocations.slice().sort((a, b) => b.remainder - a.remainder || a.member.localeCompare(b.member)).forEach((row) => {
        if (remaining > 0) {
            row.amount++;
            remaining--;
        }
    });
    return allocations.map((row) => ({ member: row.member, amount: row.amount * (total < 0 ? -1 : 1) }));
}

function calculate(receipt) {
    object(receipt, ["input_mode", "items", "discount", "service_rate_bp", "service_amount", "gst_mode", "gst_rate_bp", "gst_amount", "adjustment"], "receipt");
    if (["items", "subtotals"].indexOf(receipt.input_mode) < 0) throw new Error("Choose items or per-person subtotals.");
    if (!Array.isArray(receipt.items) || !receipt.items.length || receipt.items.length > 100) throw new Error("Enter between 1 and 100 receipt items.");
    const totals = Object.create(null);
    let subtotal = 0;
    receipt.items.forEach((item) => {
        object(item, ["label", "amount", "members"], "item");
        if (typeof item.label !== "string" || !item.label.trim() || item.label.length > 120) throw new Error("Give each item a name of at most 120 characters.");
        integer(item.amount, 1, MAX_AMOUNT, "item amount");
        if (!Array.isArray(item.members) || !item.members.length || item.members.length > 50 || (receipt.input_mode === "subtotals" && item.members.length !== 1)) throw new Error("Assign each item to its participants.");
        const seen = Object.create(null);
        item.members.forEach((member) => {
            if (typeof member !== "string" || !/^[a-z0-9]{15}$/.test(member) || seen[member]) throw new Error("Select each item participant once.");
            seen[member] = true;
            if (receipt.input_mode === "subtotals" && totals[member] !== undefined) throw new Error("Enter one subtotal per person.");
            if (totals[member] === undefined) totals[member] = 0;
        });
        distribute(item.amount, item.members.map((member) => ({ member, weight: 1 }))).forEach((share) => {
            totals[share.member] += share.amount;
        });
        subtotal += item.amount;
        integer(subtotal, 1, MAX_AMOUNT, "receipt subtotal");
    });
    const ids = Object.keys(totals).sort();
    if (ids.length > 50) throw new Error("A receipt can include up to 50 people.");
    const discount = integer(receipt.discount, 0, subtotal - 1, "discount smaller than the subtotal");
    const serviceRate = integer(receipt.service_rate_bp, 0, 10000, "service charge percentage between 0 and 100");
    const gstRate = integer(receipt.gst_rate_bp, 0, 10000, "GST percentage between 0 and 100");
    if (["included", "added", "none"].indexOf(receipt.gst_mode) < 0) throw new Error("Choose how GST is charged.");
    const adjustment = integer(receipt.adjustment, -MAX_AMOUNT, MAX_AMOUNT, "receipt adjustment");
    for (const field of ["service_amount", "gst_amount"]) {
        if (receipt[field] !== null) integer(receipt[field], 0, MAX_AMOUNT, field === "service_amount" ? "service charge amount" : "GST amount");
    }

    if (receipt.gst_mode !== "added" && receipt.gst_amount !== null) throw new Error("Only added GST can use a receipt amount override.");
    const discounted = subtotal - discount;
    const gstIncluded = receipt.gst_mode === "included" ? rounded(discounted, gstRate, 10000 + gstRate) : 0;
    const base = discounted - gstIncluded;
    const service = receipt.service_amount === null ? rounded(base, serviceRate, 10000) : receipt.service_amount;
    integer(base + service, 1, MAX_AMOUNT, "subtotal with service charge");
    const gst = receipt.gst_mode === "none" ? 0 : receipt.gst_mode === "included" ? rounded(service, gstRate, 10000) : receipt.gst_amount === null ? rounded(base + service, gstRate, 10000) : receipt.gst_amount;
    const amount = integer(discounted + service + gst + adjustment, 1, MAX_AMOUNT, "receipt total");
    const rows = ids.map((member) => ({ member, items: totals[member], discount: 0, service: 0, gst: 0, gst_included: 0, adjustment: 0, amount: 0 }));
    function assign(field, value, weights) {
        const parts = distribute(value, rows.map((row) => ({ member: row.member, weight: weights(row) })));
        parts.forEach((share, index) => {
            rows[index][field] = share.amount;
        });
    }

    assign("discount", discount, (row) => row.items);
    assign("gst_included", gstIncluded, (row) => row.items - row.discount);
    assign("service", service, (row) => row.items - row.discount - row.gst_included);
    assign("gst", gst, (row) => receipt.gst_mode === "included" ? row.service : row.items - row.discount + row.service);
    assign("adjustment", adjustment, (row) => row.items - row.discount + row.service + row.gst);
    rows.forEach((row) => {
        row.amount = row.items - row.discount + row.service + row.gst + row.adjustment;
        if (row.amount < 0) throw new Error("The adjustment would make a person's share negative.");
    });
    return { subtotal, discount, service, gst, gst_included: gstIncluded, adjustment, amount, rows, shares: rows.map((row) => ({ member: row.member, amount: row.amount })) };
}

module.exports = { calculate };
