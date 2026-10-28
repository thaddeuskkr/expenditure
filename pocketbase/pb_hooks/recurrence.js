const frequencies = ["daily", "weekly", "monthly", "yearly"];
const managed = ["recurrence_timezone", "recurrence_anchor", "recurrence_next", "recurrence_error"];
function validateInput(data) {
    for (const [field, minimum, maximum] of [["recurrence_interval", 0, 365], ["recurrence_day", -1, 31]]) {
        if (data[field] !== undefined && (!Number.isInteger(data[field]) || data[field] < minimum || data[field] > maximum))
            throw new BadRequestError(`${field} must be a whole number from ${minimum} to ${maximum}.`);
    }
}

function protect(record, data) {
    validateInput(data);
    managed.forEach((field) => record.set(field, record.isNew() ? "" : record.original().getString(field)));
    record.set("recurrence_error", "");
}

function wall(instant, timezone) {
    return new DateTime(instant).time().in(new Timezone(timezone)).format("2006-01-02T15:04:05");
}

function advance(local, frequency, anchor, periods, interval, day) {
    const date = new Date(local + "Z");
    if (frequency === "daily" || frequency === "weekly") date.setUTCDate(date.getUTCDate() + periods * interval * (frequency === "daily" ? 1 : 7));
    else {
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + periods * interval * (frequency === "monthly" ? 1 : 12));
        const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        const requested = frequency === "monthly" && day ? (day === -1 ? last : day) : Number(anchor.slice(8, 10));
        date.setUTCDate(Math.min(requested, last));
    }

    return date.toISOString().slice(0, 10) + " " + anchor.slice(11, 19);
}

function instant(target, timezone) {
    // Keep the original wall-clock time even after a DST gap was normalized.
    let result = new DateTime(target, timezone).string();
    // Go can normalize nonexistent spring-forward times backwards. Move such a
    // occurrence forward by the size of the gap, keeping subsequent days anchored.
    const represented = wall(result, timezone).replace("T", " ");
    if (represented < target) {
        const gap = Date.parse(target.replace(" ", "T") + "Z") - Date.parse(represented.replace(" ", "T") + "Z");
        result = new Date(Date.parse(result.replace(" ", "T")) + gap).toISOString();
    }

    return new Date(result.replace(" ", "T")).toISOString();
}

function nextDate(previous, frequency, anchor, timezone, interval, day) {
    return instant(advance(wall(previous, timezone), frequency, anchor, 1, interval || 1, day || 0), timezone);
}

// Start or change a schedule with its next future occurrence. This avoids
// recreating history when an old transaction is enabled or a paused schedule resumes.
function firstFuture(previous, frequency, anchor, timezone, now, interval, day) {
    interval = interval || 1;
    day = day || 0;
    const threshold = Math.max(now, Date.parse(previous));
    const date = new Date(anchor + "Z");
    const current = new Date(wall(new Date(threshold).toISOString(), timezone) + "Z");
    let periods = 0;
    if (frequency === "daily" || frequency === "weekly") {
        const days = interval * (frequency === "daily" ? 1 : 7);
        periods = Math.max(1, Math.floor((current.getTime() - date.getTime()) / (days * 86400000)));
    } else {
        const months = (current.getUTCFullYear() - date.getUTCFullYear()) * 12 + current.getUTCMonth() - date.getUTCMonth();
        const step = interval * (frequency === "monthly" ? 1 : 12);
        // A chosen monthly day can still fall later in the original month.
        periods = Math.max(frequency === "monthly" && day ? 0 : 1, Math.floor(months / step));
    }

    let next;
    do {
        next = instant(advance(anchor, frequency, anchor, periods++, interval, day), timezone);
    } while (Date.parse(next) <= threshold);

    return next;
}

function configure(record, app, user) {
    const frequency = record.getString("recurrence");
    const kind = record.getString("kind");
    if (["expense", "income"].indexOf(kind) < 0) throw new BadRequestError("Choose expense or income.");
    if (frequency && frequencies.indexOf(frequency) < 0)
        throw new BadRequestError("Choose a valid repeat frequency.");
    if (!frequency) {
        managed.forEach((field) => record.set(field, ""));
        record.set("recurrence_interval", 0);
        record.set("recurrence_day", 0);
        return;
    }

    const interval = record.get("recurrence_interval") || 1;
    const day = record.get("recurrence_day");
    if (!Number.isInteger(interval) || interval < 1 || interval > 365)
        throw new BadRequestError("Repeat intervals must be whole numbers from 1 to 365.");
    if (!Number.isInteger(day) || day < -1 || day > 31 || (frequency !== "monthly" && day !== 0))
        throw new BadRequestError("Choose a monthly day from 1 to 31, the original date, or the last day.");
    record.set("recurrence_interval", interval);
    const original = record.original();
    if (record.isNew() || (original.getString("recurrence_error") && !record.getString("recurrence_error")) || frequency !== original.getString("recurrence") || interval !== original.getInt("recurrence_interval") || day !== original.getInt("recurrence_day") || record.getString("occurred_at") !== original.getString("occurred_at")) {
        const timezone = require(`${__hooks}/configuration.js`).preferences(app, user).timezone;
        const anchor = wall(record.getString("occurred_at"), timezone);
        record.set("recurrence_timezone", timezone);
        record.set("recurrence_anchor", anchor);
        record.set("recurrence_next", firstFuture(record.getString("occurred_at"), frequency, anchor, timezone, Date.now(), interval, day));
        record.set("recurrence_error", "");
    }
}

function generate(app, collection, id, now) {
    app.runInTransaction((tx) => {
        const seed = tx.findRecordById(collection, id);
        if (!seed.getString("recurrence") || seed.getString("recurrence_error")) return;
        let next = seed.getString("recurrence_next");
        for (let count = 0; next && Date.parse(next) <= now && count < 100; count++) {
            let actor, members, before;
            const shared = collection === "circle_expenses";
            if (shared) {
                const service = require(`${__hooks}/circles-service.js`);
                actor = tx.findRecordById("circle_members", seed.getString("created_by"));
                service.access(tx, seed.getString("circle"), actor.getString("user"));
                members = service.memberRecords(tx, seed.getString("circle"));
                service.memberInCircle(members, seed.getString("paid_by"), []);
                JSON.parse(seed.getString("shares")).forEach((share) => service.memberInCircle(members, share.member, []));
                if (tx.countRecords(collection, $dbx.hashExp({ circle: seed.getString("circle") })) >= 10000) throw new Error("This circle has reached its entry limit.");
                require(`${__hooks}/circle-categories.js`).select(tx, seed.getString("circle"), seed.getString("category"), null);
                before = service.balances(tx, seed.getString("circle"));
            } else tx.findRecordById("users", seed.getString("user"));
            const copy = new Record(tx.findCollectionByNameOrId(collection));
            const fields = shared ? ["circle", "title", "category", "source", "paid_by", "created_by", "split_mode", "shares", "receipt"] : ["user", "merchant", "category"];
            fields.concat(["kind", "amount", "currency", "notes", "payment_method"]).forEach((field) => copy.set(field, seed.get(field)));
            copy.set("occurred_at", next);
            if (shared) copy.set("version", 1);
            else copy.set("source", "manual");
            tx.save(copy);
            if (shared) require(`${__hooks}/circles-service.js`).preserveFormerBalances(tx, seed.getString("circle"), members, before);
            next = nextDate(next, seed.getString("recurrence"), seed.getString("recurrence_anchor"), seed.getString("recurrence_timezone"), seed.getInt("recurrence_interval"), seed.getInt("recurrence_day"));
        }

        seed.set("recurrence_next", next);
        if (collection === "circle_expenses") seed.set("version", seed.getInt("version") + 1);
        tx.save(seed);
    });
}

function run(app, now) {
    now = now === undefined ? Date.now() : now;
    for (const collection of ["expenses", "circle_expenses"]) {
        const seeds = app.findRecordsByFilter(collection, "recurrence != '' && recurrence_error = '' && recurrence_next <= {:now}", "recurrence_next,id", 100, 0, { now: new Date(now).toISOString() });
        seeds.forEach((seed) => {
            try {
                generate(app, collection, seed.id, now);
            } catch (error) {
                // Re-read inside the transaction: never overwrite a concurrent edit.
                app.runInTransaction((tx) => {
                    let current;
                    try {
                        current = tx.findRecordById(collection, seed.id);
                    } catch {
                        return;
                    }

                    if (current.getString("recurrence_next") !== seed.getString("recurrence_next")) return;
                    current.set("recurrence_error", String(error.message || error).slice(0, 300));
                    if (collection === "circle_expenses") current.set("version", current.getInt("version") + 1);
                    tx.save(current);
                });
            }
        });
    }
}

module.exports = { configure, protect, validateInput, nextDate, firstFuture, run };
