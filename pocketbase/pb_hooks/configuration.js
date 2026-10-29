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
    if (!found.length) {
        initialize(app, user);
        return preferences(app, user);
    }

    return found[0].publicExport();
}

function categories(app, user) {
    const records = app.findRecordsByFilter(
        "categories",
        "user = {:user}",
        "sort_order,created,name,id",
        0,
        0,
        { user },
    );
    if (!records.length) {
        initialize(app, user);
        return categories(app, user);
    }

    return records.map((record) => record.publicExport());
}

function initialize(app, user) {
    app.runInTransaction((tx) => {
        if (tx.countRecords("preferences", $dbx.hashExp({ user })) === 0) {
            const record = new Record(tx.findCollectionByNameOrId("preferences"));
            record.load({ user, currency: "SGD", timezone: "Asia/Singapore", currencies: defaults, default_tab: "Overview", time_format: "24h", show_circle_transactions: false, include_circle_in_budgets: true, default_api_circle: "" });
            tx.save(record);
        }

        if (tx.countRecords("categories", $dbx.hashExp({ user })) > 0) return;
        defaultNames.forEach((name, i) => {
            const record = new Record(tx.findCollectionByNameOrId("categories"));
            record.load({
                user,
                name,
                color: colors[i % colors.length],
                active: true,
                sort_order: i,
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

function personalCategoryMapper(app, user) {
    const names = categories(app, user).map((item) => item.name);
    const key = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();
    const other = names.find((name) => key(name) === "other") || "Other";
    const cached = Object.create(null);
    return (name) => {
        if (Object.prototype.hasOwnProperty.call(cached, name)) return cached[name];
        const exact = names.find((item) => item === name);
        const matches = exact ? [exact] : names.filter((item) => key(item) === key(name));
        cached[name] = matches.length === 1 ? matches[0] : other;
        return cached[name];
    };
}

function validate(record, app) {
    const name = record.collection().name;
    if (name === "expenses") {
        if (record.isNew() && !record.getString("kind")) record.set("kind", "expense");
        require(`${__hooks}/recurrence.js`).configure(record, app, record.getString("user"));
    }

    if (name === "preferences" && record.isNew() && !record.getString("default_tab")) record.set("default_tab", "Overview");
    if (name === "preferences" && record.isNew() && !record.getString("time_format")) record.set("time_format", "24h");
    const user = record.getString("user");
    const code = record.getString("currency");
    if (!currency(code)) throw new BadRequestError("Unsupported currency.");
    if (name === "preferences") {
        const circle = record.getString("default_api_circle");
        if (circle && (record.isNew() || circle !== record.original().getString("default_api_circle"))) {
            try {
                require(`${__hooks}/circles-service.js`).access(app, circle, user);
            } catch {
                throw new BadRequestError("Choose a Circle you currently belong to as your default API workspace.");
            }
        }

        const selected = record.getStringSlice("currencies");
        if (!selected.length) throw new BadRequestError("Enable at least one currency.");
        if (selected.indexOf(code) < 0)
            throw new BadRequestError("The main currency must be enabled.");
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
    defaultNames,
    colors,
    catalog,
    currency,
    preferences,
    categories,
    initialize,
    category,
    personalCategoryMapper,
    validate,
};
