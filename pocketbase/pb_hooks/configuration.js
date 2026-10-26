const catalog = require(`${__hooks}/currencies.json`);
const defaults = ["SGD", "USD", "EUR", "GBP", "AUD", "MYR"];
const defaultNames = [
    "Food & drinks",
    "Groceries",
    "Transport",
    "Shopping",
    "Entertainment",
    "Bills & utilities",
    "Health",
    "Other",
];
const colors = [
    "#bfc9a4",
    "#8dada0",
    "#b7b9cf",
    "#d6b79a",
    "#a8b6c5",
    "#c9c293",
    "#c3a4af",
    "#999d94",
];
const byCode = Object.create(null);
catalog.forEach((c) => {
    byCode[c.code] = c;
});
function currency(code) {
    return byCode[code];
}

function preferences(app, user) {
    const found = app.findRecordsByFilter(
        "preferences",
        "user = {:user}",
        "",
        1,
        0,
        { user },
    );
    if (!found.length)
        return {
            currency: "SGD",
            timezone: "Asia/Singapore",
            currencies: defaults.slice(),
        };
    const result = found[0].publicExport();
    const selected = found[0].getStringSlice("currencies");
    result.currencies = selected.length ?
        selected :
            defaults.concat(result.currency).filter((c, i, a) => a.indexOf(c) === i);
    return result;
}

function categories(app, user) {
    const records = app.findRecordsByFilter(
        "categories",
        "user = {:user}",
        "created,name",
        0,
        0,
        { user },
    );
    return records.length ?
            records.map((r) => r.publicExport()) :
            defaultNames.map((name, i) => ({ name, color: colors[i], active: true }));
}

function initialize(app, user) {
    app.runInTransaction((tx) => {
        if (tx.countRecords("categories", $dbx.hashExp({ user })) > 0) return;
        // Include preexisting names so upgrades and restored backups retain them.
        const names = defaultNames.slice();
        const used = arrayOf(new DynamicModel({ name: "" }));
        tx.db()
            .newQuery(
                "SELECT category AS name FROM expenses WHERE user = {:user} UNION SELECT category AS name FROM budgets WHERE user = {:user} AND category != 'Overall'",
            )
            .bind({ user })
            .all(used);
        used.forEach((row) => {
            if (names.every((name) => name.toLowerCase() !== row.name.toLowerCase()))
                names.push(row.name);
        });
        names.forEach((name, i) => {
            const record = new Record(tx.findCollectionByNameOrId("categories"));
            record.load({
                user,
                name,
                color: colors[i % colors.length],
                active: true,
            });
            tx.save(record);
        });
    });
}

function category(app, user, name, allowArchived) {
    const match = categories(app, user).filter(
        (c) => c.name.toLowerCase() === String(name).toLowerCase(),
    )[0];
    if (!match || (!match.active && !allowArchived))
        throw new BadRequestError("Choose an active category from your account.");
    return match.name;
}

function validate(record, app) {
    const name = record.collection().name;
    const user = record.getString("user");
    const code = record.getString("currency");
    if (!currency(code)) throw new BadRequestError("Unsupported currency.");
    if (name === "preferences") {
        let selected = record.getStringSlice("currencies");
        if (!selected.length)
            selected = defaults.concat(code).filter((c, i, a) => a.indexOf(c) === i);
        if (selected.indexOf(code) < 0)
            throw new BadRequestError("The main currency must be enabled.");
        record.set("currencies", selected);
    } else {
        const original = record.original();
        const sameCurrency =
            !record.isNew() && code === original.getString("currency");
        if (!sameCurrency && preferences(app, user).currencies.indexOf(code) < 0)
            throw new BadRequestError("Enable this currency in Settings first.");
        const selected = record.getString("category");
        const sameCategory =
            !record.isNew() && selected === original.getString("category");
        if (!(name === "budgets" && selected === "Overall"))
            record.set("category", category(app, user, selected, sameCategory));
    }
}

module.exports = {
    catalog,
    currency,
    preferences,
    categories,
    initialize,
    category,
    validate,
};
