const cacheId = "fxlatest0000000";
const HOUR_MS = 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = HOUR_MS;
const STALE_CACHE_AGE_MS = 36 * HOUR_MS;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const FETCH_LEASE_MS = 30 * 1000;
const MAX_RATE_AGE_MS = 14 * 24 * HOUR_MS;

function timestamp(ms) {
    return new Date(ms).toISOString().replace("T", " ");
}

function read(app) {
    const record = app.findRecordById("exchange_rates", cacheId);
    const data = JSON.parse(record.getString("data"));
    return {
        quotes: data.quotes,
        dates: data.dates,
        fetched_at: record.getString("fetched_at"),
        attempted_at: record.getString("attempted_at"),
        provider: "Frankfurter",
        source_url: "https://frankfurter.dev/",
        stale:
      !record.getString("fetched_at") ||
      Date.now() - new Date(record.getString("fetched_at")).getTime() >
      STALE_CACHE_AGE_MS,
    };
}

function refresh(app) {
    const current = read(app);
    const now = Date.now();
    if (
        current.fetched_at &&
        now - new Date(current.fetched_at).getTime() < REFRESH_INTERVAL_MS
    )
        return current;
    // An atomic lease prevents parallel requests and cron jobs fetching at once.
    // Attempts are limited to one per five minutes, including failed requests.
    const lock = app
        .db()
        .newQuery(
            "UPDATE exchange_rates SET attempted_at = {:now}, locked_until = {:until} WHERE id = {:id} AND (locked_until = '' OR locked_until < {:now}) AND (attempted_at = '' OR attempted_at < {:retry})",
        )
        .bind({
            id: cacheId,
            now: timestamp(now),
            until: timestamp(now + FETCH_LEASE_MS),
            retry: timestamp(now - RETRY_DELAY_MS),
        })
        .execute();
    if (!lock.rowsAffected()) return read(app);
    try {
        const response = $http.send({
            url:
        $os.getenv("EXPENDITURE_FX_URL") ||
        "https://api.frankfurter.dev/v2/rates?base=EUR",
            method: "GET",
            timeout: 10,
            headers: { Accept: "application/json" },
        });
        if (response.statusCode !== 200 || !Array.isArray(response.json))
            throw new Error("Invalid exchange-rate response.");
        const config = require(`${__hooks}/configuration.js`);
        const quotes = Object.assign({}, current.quotes, { EUR: 1 });
        const dates = Object.assign({}, current.dates);
        const seen = {};
        response.json.forEach((row) => {
            if (row.base !== "EUR" || !config.currency(row.quote)) return;
            if (
                typeof row.rate !== "number" ||
                !isFinite(row.rate) ||
                row.rate <= 0 ||
                !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
                !isFinite(Date.parse(row.date)) ||
                row.date > new Date().toISOString().slice(0, 10)
            )
                throw new Error("Invalid exchange rate.");
            seen[row.quote] = true;
            // Keep the newest observation for each quote, never a partial replacement.
            if (!dates[row.quote] || dates[row.quote] <= row.date) {
                quotes[row.quote] = row.rate;
                dates[row.quote] = row.date;
            }
        });
        if (Object.keys(seen).length < 2 || !seen.USD || !seen.SGD)
            throw new Error("Incomplete exchange-rate response.");
        const record = app.findRecordById("exchange_rates", cacheId);
        record.set("data", { quotes, dates });
        record.set("fetched_at", timestamp(now));
        record.set("locked_until", "");
        app.save(record);
    } catch (error) {
        app
            .db()
            .newQuery("UPDATE exchange_rates SET locked_until = '' WHERE id = {:id}")
            .bind({ id: cacheId })
            .execute();
        app
            .logger()
            .warn(
                "Exchange-rate refresh failed; retaining cached rates",
                "error",
                String(error),
            );
    }

    return read(app);
}

function convert(amount, from, to, snapshot) {
    if (from === to) return amount;
    const config = require(`${__hooks}/configuration.js`);
    const source = config.currency(from);
    const target = config.currency(to);
    if (!source || !target || !snapshot.quotes[from] || !snapshot.quotes[to])
        return null;
    // Old observations stay visible with their date, but rates over 14 days old
    // are excluded from totals instead of being passed off as current estimates.
    const dates = [snapshot.dates[from], snapshot.dates[to]].filter(Boolean);
    if (
        !dates.length ||
        dates.some((date) => Date.now() - Date.parse(date) > MAX_RATE_AGE_MS)
    )
        return null;
    const sourceUnits = amount / Math.pow(10, source.digits);
    const targetUnits =
        (sourceUnits * snapshot.quotes[to]) / snapshot.quotes[from];
    const result = Math.round(targetUnits * Math.pow(10, target.digits));
    return isFinite(result) && Math.abs(result) <= 9007199254740991 ?
        result :
        null;
}

module.exports = { read, refresh, convert };
