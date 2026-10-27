const frequencies = ["daily", "weekly", "monthly", "yearly"];
const managed = ["recurrence_timezone", "recurrence_anchor", "recurrence_next", "recurrence_error"];
function protect(record) {
    managed.forEach((field) => record.set(field, record.isNew() ? "" : record.original().getString(field)));
    record.set("recurrence_error", "");
}

function wall(instant, timezone) {
    return new DateTime(instant).time().in(new Timezone(timezone)).format("2006-01-02T15:04:05");
}

function nextDate(previous, frequency, anchor, timezone) {
    const local = wall(previous, timezone);
    const date = new Date(local + "Z");
    if (frequency === "daily" || frequency === "weekly") date.setUTCDate(date.getUTCDate() + (frequency === "daily" ? 1 : 7));
    else {
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + (frequency === "monthly" ? 1 : 12));
        const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        date.setUTCDate(Math.min(Number(anchor.slice(8, 10)), last));
    }

    // Keep the original wall-clock time even after a DST gap was normalized.
    const target = date.toISOString().slice(0, 10) + " " + anchor.slice(11, 19);
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

// Start or change a schedule with its next future occurrence. This avoids
// recreating history when an old expense is enabled or a paused schedule resumes.
function firstFuture(instant, frequency, anchor, timezone, now) {
    const date = new Date(anchor + "Z");
    const current = new Date(wall(new Date(now).toISOString(), timezone) + "Z");
    let periods = 0;
    if (frequency === "daily" || frequency === "weekly") {
        const days = frequency === "daily" ? 1 : 7;
        periods = Math.max(0, Math.floor((current.getTime() - date.getTime()) / (days * 86400000)) - 1);
        date.setUTCDate(date.getUTCDate() + periods * days);
    } else {
        const months = (current.getUTCFullYear() - date.getUTCFullYear()) * 12 + current.getUTCMonth() - date.getUTCMonth();
        const step = frequency === "monthly" ? 1 : 12;
        periods = Math.max(0, Math.floor(months / step) - 1);
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + periods * step);
        const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        date.setUTCDate(Math.min(Number(anchor.slice(8, 10)), last));
    }

    let next = periods ? new DateTime(date.toISOString().slice(0, 19).replace("T", " "), timezone).string() : instant;
    do {
        next = nextDate(next, frequency, anchor, timezone);
    } while (Date.parse(next) <= now);

    return next;
}

function configure(record, app, user) {
    const frequency = record.getString("recurrence");
    const kind = record.getString("kind");
    if (["expense", "income"].indexOf(kind) < 0) throw new BadRequestError("Choose expense or income.");
    if (frequency && (frequencies.indexOf(frequency) < 0 || kind !== "expense"))
        throw new BadRequestError("Choose a valid recurrence for an expense.");
    if (!frequency) {
        managed.forEach((field) => record.set(field, ""));
        return;
    }

    const original = record.original();
    if (record.isNew() || (original.getString("recurrence_error") && !record.getString("recurrence_error")) || frequency !== original.getString("recurrence") || record.getString("occurred_at") !== original.getString("occurred_at")) {
        const timezone = require(`${__hooks}/configuration.js`).preferences(app, user).timezone;
        const anchor = wall(record.getString("occurred_at"), timezone);
        record.set("recurrence_timezone", timezone);
        record.set("recurrence_anchor", anchor);
        record.set("recurrence_next", firstFuture(record.getString("occurred_at"), frequency, anchor, timezone, Date.now()));
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
            const fields = shared ? ["circle", "title", "category", "source", "paid_by", "created_by", "split_mode", "shares"] : ["user", "merchant", "category"];
            fields.concat(["kind", "amount", "currency", "notes", "payment_method"]).forEach((field) => copy.set(field, seed.get(field)));
            copy.set("occurred_at", next);
            if (shared) copy.set("version", 1);
            else copy.set("source", "manual");
            tx.save(copy);
            if (shared) require(`${__hooks}/circles-service.js`).preserveFormerBalances(tx, seed.getString("circle"), members, before);
            next = nextDate(next, seed.getString("recurrence"), seed.getString("recurrence_anchor"), seed.getString("recurrence_timezone"));
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

module.exports = { configure, protect, nextDate, firstFuture, run };
