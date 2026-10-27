// Shared by PocketBase and the browser: all allocation math uses integer units.
const ICONS = [
    "users",
    "plane",
    "home",
    "utensils",
    "coffee",
    "gift",
    "briefcase",
    "car",
    "music",
    "heart",
];
const MAX_AMOUNT = 99999999999;

function parseDecimal(value, digits) {
    if (typeof value !== "string" || !Number.isInteger(digits) || digits < 0 || digits > 4)
        throw new Error("Enter a valid decimal amount.");
    const pattern = new RegExp(`^\\d{1,11}${digits ? `(\\.\\d{1,${digits}})?` : ""}$`);
    if (!pattern.test(value.trim()))
        throw new Error(
            digits ? `Use at most ${digits} decimal places.` : "Use a whole-number amount.",
        );
    const [whole, fraction = ""] = value.trim().split(".");
    const units = Number(whole) * Math.pow(10, digits) + Number(fraction.padEnd(digits, "0"));
    if (!Number.isSafeInteger(units) || units > MAX_AMOUNT)
        throw new Error("The amount is too large.");
    return units;
}

function allocate(amount, mode, shares) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT)
        throw new Error("Enter a positive expense amount.");
    if (["even", "percentage", "exact"].indexOf(mode) < 0)
        throw new Error("Choose an equal, percentage, or exact-amount split.");
    if (!Array.isArray(shares) || !shares.length || shares.length > 50)
        throw new Error("Select between 1 and 50 participants.");
    const seen = Object.create(null);
    const rows = shares.map((share) => {
        if (
            !share ||
            typeof share.member !== "string" ||
            !/^[a-z0-9]{15}$/.test(share.member) ||
            seen[share.member]
        )
            throw new Error("Select each participant only once.");
        const field = mode === "percentage" ? "percentage_bp" : "amount";
        const allowed = mode === "even" ? ["member"] : ["member", field];
        if (Object.keys(share).some((key) => allowed.indexOf(key) < 0))
            throw new Error("Use member, amount for exact splits, or percentage_bp for percentage splits.");
        seen[share.member] = true;
        const weight = mode === "even" ? 1 : share[field];
        if (!Number.isSafeInteger(weight) || weight < 0 || weight > (mode === "percentage" ? 10000 : MAX_AMOUNT))
            throw new Error(mode === "percentage" ? "Use integer percentage_bp between 0 and 10000." : "Use integer amount in currency minor units.");
        return { member: share.member, weight, amount: mode === "exact" ? weight : 0 };
    });
    const total = rows.reduce((sum, row) => sum + row.weight, 0);
    if (mode === "exact") {
        if (total !== amount) throw new Error("Exact amounts must add up to the expense total.");
        return rows.map((row) => ({ member: row.member, amount: row.amount }));
    }

    if (mode === "percentage" && total !== 10000)
        throw new Error("Percentages must add up to exactly 100%.");
    rows.forEach((row) => {
        row.amount = Math.floor((amount * row.weight) / total);
        row.remainder = (amount * row.weight) % total;
    });
    let remaining = amount - rows.reduce((sum, row) => sum + row.amount, 0);
    // Largest remainder; member id breaks ties, so request ordering never changes a share.
    rows.slice()
        .sort((a, b) => b.remainder - a.remainder || a.member.localeCompare(b.member))
        .forEach((row) => {
            if (remaining > 0) {
                row.amount++;
                remaining--;
            }
        });
    return rows.map((row) => ({
        member: row.member,
        amount: row.amount,
        ...(mode === "percentage" ? { percentage_bp: row.weight } : {}),
    }));
}

function suggestions(balances) {
    const result = [];
    const currencies = Array.from(new Set(balances.map((row) => row.currency))).sort();
    currencies.forEach((currency) => {
        const rows = balances.filter((row) => row.currency === currency);
        if (rows.reduce((sum, row) => sum + row.net, 0) !== 0)
            throw new Error("Circle balances do not add up.");
        const debtors = rows
            .filter((row) => row.net < 0)
            .map((row) => ({ member: row.member, amount: -row.net }));
        const creditors = rows
            .filter((row) => row.net > 0)
            .map((row) => ({ member: row.member, amount: row.net }));
        [debtors, creditors].forEach((list) =>
            list.sort((a, b) => b.amount - a.amount || a.member.localeCompare(b.member)),
        );
        let debtor = 0,
            creditor = 0;
        while (debtor < debtors.length && creditor < creditors.length) {
            const amount = Math.min(debtors[debtor].amount, creditors[creditor].amount);
            result.push({
                from_member: debtors[debtor].member,
                to_member: creditors[creditor].member,
                currency,
                amount: amount,
            });
            debtors[debtor].amount -= amount;
            creditors[creditor].amount -= amount;
            if (!debtors[debtor].amount) debtor++;
            if (!creditors[creditor].amount) creditor++;
        }
    });
    return result;
}

module.exports = { ICONS, MAX_AMOUNT, parseDecimal, allocate, suggestions };
