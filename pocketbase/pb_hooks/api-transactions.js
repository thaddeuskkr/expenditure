const api = require(`${__hooks}/expenditure.js`);

function conflict() {
    throw new ApiError(409, "Idempotency-Key is already in use for different data within the 24-hour retry window. Use a new key for a new purchase.");
}

function create(e, explicitCircle) {
    const data = e.requestInfo().body;
    const label = explicitCircle ? "title" : "merchant";
    const allowed = [label, "amount", "currency", "category", "occurred_at", "payment_method", "notes"];
    if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).some((field) => allowed.indexOf(field) < 0))
        throw new BadRequestError(`Send only ${allowed.join(", ")}.`);
    const input = Object.assign({}, data);
    if (explicitCircle) {
        input.merchant = input.title;
        delete input.title;
    }

    const key = e.request.header.get("Idempotency-Key");
    if (key && !/^[A-Za-z0-9_.:-]{1,128}$/.test(key)) throw new BadRequestError("Invalid Idempotency-Key.");
    // Authenticate again inside the transaction, including on replay.
    api.authenticate(e, "expenses:write");
    let result, identity, replay = false;
    e.app.runInTransaction((app) => {
        identity = api.authenticate(e, "expenses:write", app);
        const circles = require(`${__hooks}/circles-service.js`);
        let receipt;
        if (key) {
            const cutoff = new Date(Date.now() - api.IDEMPOTENCY_TTL_MS).toISOString().replace("T", " ");
            // Expire receipts independently of mutable or deleted ledger records.
            app.db().newQuery("DELETE FROM api_transaction_retries WHERE created <= {:cutoff}").bind({ cutoff }).execute();
            app.db().newQuery("UPDATE expenses SET idempotency_key = '' WHERE user = {:user} AND idempotency_key = {:key} AND created <= {:cutoff}")
                .bind({ user: identity.user.id, key, cutoff }).execute();
            receipt = app.findRecordsByFilter("api_transaction_retries", "user = {:user} && key = {:key}", "", 1, 0, { user: identity.user.id, key })[0];
        }

        let circleId = explicitCircle || "";
        if (receipt) {
            if (explicitCircle && receipt.getString("circle") !== explicitCircle) conflict();
            circleId = receipt.getString("circle");
            const original = JSON.parse(receipt.getString("request"));
            const fields = api.validateExpense(input, app, identity.user.id, original);
            if (!["merchant", "amount", "currency", "category", "notes", "payment_method"].every((field) => String(original[field]) === String(fields[field])) ||
                (input.occurred_at !== undefined && Date.parse(original.occurred_at) !== Date.parse(fields.occurred_at))) conflict();
            if (circleId) checkCircle(app, circles, circleId, identity.user.id, !explicitCircle);
            let record;
            try {
                record = app.findRecordById(circleId ? "circle_expenses" : "expenses", receipt.getString("transaction"));
            } catch {
                throw new ApiError(410, "This transaction was deleted or moved to another ledger. Use a new Idempotency-Key to intentionally create another expense.");
            }

            replay = true;
            result = response(record, receipt, circleId);
            return;
        }

        if (!explicitCircle) circleId = require(`${__hooks}/configuration.js`).preferences(app, identity.user.id).default_api_circle;
        const circle = circleId ? checkCircle(app, circles, circleId, identity.user.id, !explicitCircle).circle : null;
        const fields = api.validateExpense(input, app, identity.user.id, null, circle);
        let record;
        if (circle) record = circles.createApiRecord(app, identity, circleId, fields);
        else {
            record = new Record(app.findCollectionByNameOrId("expenses"));
            record.load(fields);
            record.load({ user: identity.user.id, source: "api", idempotency_key: key || "", idempotency_data: key ? fields : null });
            app.save(record);
        }

        if (key) {
            receipt = new Record(app.findCollectionByNameOrId("api_transaction_retries"));
            receipt.load({ user: identity.user.id, key, circle: circleId, transaction: record.id, request: fields, created: record.getString("created") });
            app.save(receipt);
        }

        result = response(record, receipt, circleId);
    });
    api.touch(e.app, identity.key);
    return e.json(replay ? 200 : 201, Object.assign(result, { replay }));
}

function checkCircle(app, circles, id, user, defaultDestination) {
    try {
        return circles.access(app, id, user);
    } catch (error) {
        if (!defaultDestination) throw error;
        throw new NotFoundError("The API transaction's Circle is unavailable. Choose an active default API workspace in Settings. Retries keep their original destination.");
    }
}

function response(record, receipt, circle) {
    return Object.assign(record.publicExport(), {
        destination: circle ? "circle" : "personal",
        idempotency_expires_at: receipt ? new Date(Date.parse(receipt.getString("created").replace(" ", "T")) + api.IDEMPOTENCY_TTL_MS).toISOString() : null,
    });
}

module.exports = { create };
