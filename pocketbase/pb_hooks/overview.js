function summarize(app, user, range) {
    const config = require(`${__hooks}/configuration.js`);
    const fx = require(`${__hooks}/exchange-rates.js`);
    const main = config.preferences(app, user).currency;
    const snapshot = fx.read(app);
    const rows = arrayOf(
        new DynamicModel({
            amount_cents: 0,
            currency: "",
            category: "",
            occurred_at: "",
        }),
    );
    app
        .db()
        .newQuery(
            "SELECT amount_cents, currency, category, occurred_at FROM expenses WHERE user = {:user} AND occurred_at >= {:previous} AND occurred_at < {:to}" +
            (range.currency === "all" ? "" : " AND currency = {:currency}"),
        )
        .bind({ ...range, user })
        .all(rows);
    const result = {
        total: 0,
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
            row.amount_cents,
            row.currency,
            main,
            snapshot,
        );
        if (current) {
            result.count++;
            originals[row.currency] =
                (originals[row.currency] || 0) + row.amount_cents;
            if (converted === null) {
                result.missing_count++;
                missing[row.currency] = true;
                return;
            }

            result.total += converted;
            if (!grouped[row.category])
                grouped[row.category] = { category: row.category, total: 0, count: 0 };
            grouped[row.category].total += converted;
            grouped[row.category].count++;
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
