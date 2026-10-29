function summarize(app, user, range) {
    const config = require(`${__hooks}/configuration.js`);
    const fx = require(`${__hooks}/exchange-rates.js`);
    const preferences = config.preferences(app, user);
    const main = preferences.currency;
    const snapshot = fx.read(app);
    const personalCategory = config.personalCategoryMapper(app, user);
    const categoryDefinitions = config.categories(app, user);
    const rows = arrayOf(
        new DynamicModel({
            amount: 0,
            kind: "",
            currency: "",
            category: "",
            category_name: "",
            occurred_at: "",
            circle_share: 0,
        }),
    );
    app
        .db()
        .newQuery(
            `SELECT expense.amount, expense.kind, expense.currency, expense.category, category.name AS category_name, expense.occurred_at, 0 AS circle_share
             FROM expenses expense JOIN categories category ON category.id = expense.category
             WHERE expense.user = {:user} AND expense.moved_to = '' AND expense.occurred_at >= {:previous} AND expense.occurred_at < {:to}
             ${range.currency === "all" ? "" : "AND expense.currency = {:currency}"}
             ${preferences.include_circle_in_budgets ?
                    `UNION ALL
             SELECT json_extract(allocation.value, '$.amount') AS amount,
                    shared.kind, shared.currency, shared.category, category.name AS category_name, shared.occurred_at, 1 AS circle_share
             FROM circle_members membership
             JOIN circle_expenses shared ON shared.circle = membership.circle
             JOIN circle_categories category ON category.id = shared.category
             JOIN json_each(shared.shares) allocation ON json_extract(allocation.value, '$.member') = membership.id
             WHERE membership.user = {:user} AND shared.kind = 'expense'
               AND json_extract(allocation.value, '$.amount') > 0
               AND shared.occurred_at >= {:previous} AND shared.occurred_at < {:to}
               ${range.currency === "all" ? "" : "AND shared.currency = {:currency}"}` :
                    ""}`,
        )
        .bind({ ...range, user })
        .all(rows);
    const result = {
        total: 0,
        income: 0,
        income_missing_count: 0,
        count: 0,
        previous: 0,
        missing_count: 0,
        previous_missing_count: 0,
        missing_currencies: [],
        currency: main,
        categories: [],
        activity: [],
        original_totals: [],
        rates_fetched_at: snapshot.fetched_at,
    };
    const grouped = Object.create(null),
        activity = Object.create(null),
        originals = Object.create(null),
        missing = Object.create(null);
    rows.forEach((row) => {
        const current = row.occurred_at >= range.from;
        const converted = fx.convert(
            row.amount,
            row.currency,
            main,
            snapshot,
        );
        if (row.kind === "income") {
            if (current) {
                if (converted === null) result.income_missing_count++;
                else result.income += converted;
            }

            return;
        }

        if (current) {
            result.count++;
            originals[row.currency] =
                (originals[row.currency] || 0) + row.amount;
            if (converted === null) {
                result.missing_count++;
                missing[row.currency] = true;
                return;
            }

            result.total += converted;
            const category = row.circle_share ? personalCategory(row.category) : row.category;
            if (!grouped[category])
                grouped[category] = { category, category_name: row.circle_share ? categoryDefinitions.find((item) => item.id === category)?.name || "Other" : row.category_name, total: 0, count: 0 };
            grouped[category].total += converted;
            grouped[category].count++;
            const time = row.occurred_at.slice(0, 16).replace(" ", "T") + ":00Z";
            activity[time] = (activity[time] || 0) + converted;
        } else if (converted === null) result.previous_missing_count++;
        else result.previous += converted;
    });
    result.categories = Object.keys(grouped)
        .map((key) => grouped[key])
        .sort((a, b) => b.total - a.total);
    result.activity = Object.keys(activity)
        .sort()
        .map((occurred_at) => ({ occurred_at, total: activity[occurred_at] }));
    result.original_totals = Object.keys(originals)
        .sort()
        .map((currency) => ({ currency, total: originals[currency] }));
    result.missing_currencies = Object.keys(missing).sort();
    return result;
}

module.exports = { summarize };
