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
            record.load({ user, currency: "SGD", timezone: "Asia/Singapore", currencies: defaults, default_tab: "Overview", time_format: "24h", show_circle_transactions: false, include_circle_in_budgets: true, default_api_circle: "", default_entry_currency: "", default_expense_category: "", default_income_category: "" });
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

function category(app, user, id, allowArchived) {
    const match = categories(app, user).find((item) => item.id === id);
    if (!match || (!match.active && !allowArchived))
        throw new BadRequestError("Choose an active category from your account.");
    return match.id;
}

function categoryByName(app, user, name) {
    const match = categories(app, user).find((item) => item.name.toLowerCase() === name.toLowerCase());
    if (!match || !match.active) throw new BadRequestError("Choose an active category from your account.");
    return match;
}

function projectCategory(app, record) {
    const result = record.publicExport();
    const id = record.getString("category");
    if (id) {
        const category = app.findRecordById(record.collection().name === "circle_expenses" ? "circle_categories" : "categories", id);
        result.expand = Object.assign({}, result.expand, { category: category.publicExport() });
    }

    return result;
}

function personalCategoryMapper(app, user) {
    const personal = categories(app, user);
    const key = (name) => name.trim().replace(/\s+/g, " ").toLowerCase();
    const other = personal.find((item) => key(item.name) === "other");
    const cached = Object.create(null);
    return (circleCategory) => {
        if (Object.prototype.hasOwnProperty.call(cached, circleCategory)) return cached[circleCategory];
        const name = app.findRecordById("circle_categories", circleCategory).getString("name");
        const exact = personal.find((item) => item.name === name);
        const matches = exact ? [exact] : personal.filter((item) => key(item.name) === key(name));
        cached[circleCategory] = matches.length === 1 ? matches[0].id : other?.id || "";
        return cached[circleCategory];
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
        const entryCurrency = record.getString("default_entry_currency");
        if (entryCurrency && selected.indexOf(entryCurrency) < 0) {
            const original = record.original();
            if (!record.isNew() && entryCurrency === original.getString("default_entry_currency") && original.getStringSlice("currencies").indexOf(entryCurrency) >= 0)
                record.set("default_entry_currency", "");
            else
                throw new BadRequestError("Choose an enabled currency for new transactions.");
        }

        ["default_expense_category", "default_income_category"].forEach((field) => {
            const id = record.getString(field);
            if (!id) return;
            let category;
            try {
                category = app.findRecordById("categories", id);
            } catch {
                throw new BadRequestError("Choose an active category from your account for new transactions.");
            }

            if (category.getString("user") !== user || !category.getBool("active"))
                throw new BadRequestError("Choose an active category from your account for new transactions.");
        });
    } else {
        const original = record.original();
        const sameCurrency =
            !record.isNew() && code === original.getString("currency");
        if (!sameCurrency && preferences(app, user).currencies.indexOf(code) < 0)
            throw new BadRequestError("Enable this currency in Settings first.");
        const selected = record.getString("category");
        const sameCategory =
            !record.isNew() && selected === original.getString("category");
        if (!(name === "budgets" && selected === ""))
            record.set("category", category(app, user, selected, sameCategory));
    }
}

function savePreferences(event) {
    const app = event.app;
    try {
        // Keep category/currency validation and the preference write under the
        // same writer lock as category archiving, including nested saves.
        return app.runInTransaction((tx) => {
            event.app = tx;
            return event.next();
        });
    } finally {
        event.app = app;
    }
}

function deletePersonalContents(app, user) {
    // Required category relations must be released before their category rows.
    for (const collection of ["expenses", "budgets", "preferences", "categories"]) {
        app.findRecordsByFilter(collection, "user = {:user}", "", 0, 0, { user }).forEach((record) => app.delete(record));
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
    categoryByName,
    projectCategory,
    deletePersonalContents,
    personalCategoryMapper,
    validate,
    savePreferences,
};
