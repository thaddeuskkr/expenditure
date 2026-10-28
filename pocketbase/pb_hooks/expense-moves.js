function move(e) {
    const data = e.requestInfo().body;
    if (!data || Object.keys(data).some((key) => ["expense", "previous_updated", "category"].indexOf(key) < 0) || typeof data.expense !== "string" || !/^[a-z0-9]{15}$/.test(data.expense) || typeof data.previous_updated !== "string" || typeof data.category !== "string" || !data.category.trim())
        throw new BadRequestError("Provide the expense ID, previous_updated and a Circle category.");
    let result;
    e.app.runInTransaction((app) => {
        const service = require(`${__hooks}/circles-service.js`);
        const { circle, member } = service.access(app, e.request.pathValue("id"), e.auth.id);
        let personal;
        try {
            personal = app.findFirstRecordByFilter("expenses", "id = {:id} && user = {:user}", { id: data.expense, user: e.auth.id });
        } catch {
            throw new NotFoundError("Expense not found.");
        }

        if (personal.getString("moved_to")) {
            if (personal.getString("moved_circle") !== circle.id) throw new ApiError(409, "This expense has already moved to another Circle.");
            // Retry the move without creating a second entry or overwriting edits.
            try {
                result = app.findRecordById("circle_expenses", personal.getString("moved_to")).publicExport();
            } catch {
                throw new ApiError(409, "This expense was already moved and the Circle entry has since been deleted.");
            }

            return;
        }

        if (personal.getString("kind") !== "expense") throw new BadRequestError("Only expenses can be moved to a Circle.");
        if (personal.getString("updated") !== data.previous_updated) throw new ApiError(409, "This expense changed. Refresh it before moving.");
        if (app.countRecords("circle_expenses", $dbx.hashExp({ circle: circle.id })) >= 10000) throw new BadRequestError("This Circle has reached its entry limit.");
        const category = require(`${__hooks}/circle-categories.js`).select(app, circle.id, data.category, null);
        const members = service.memberRecords(app, circle.id), before = service.balances(app, circle.id);
        const shared = new Record(app.findCollectionByNameOrId("circle_expenses"));
        shared.id = personal.id;
        shared.load({
            circle: circle.id, title: personal.getString("merchant"), category,
            kind: "expense", paid_by: member.id, created_by: member.id, version: 1,
            split_mode: "percentage", shares: [{ member: member.id, amount: personal.getInt("amount"), percentage_bp: 10000 }],
            origin_expense: personal.id,
        });
        for (const field of ["amount", "currency", "payment_method", "notes", "occurred_at", "source", "recurrence", "recurrence_interval", "recurrence_day", "recurrence_timezone", "recurrence_anchor", "recurrence_next", "recurrence_error"]) shared.set(field, personal.get(field));
        app.save(shared);
        app.db().newQuery("UPDATE circle_expenses SET created = {:created}, updated = {:updated} WHERE id = {:id}")
            .bind({ id: shared.id, created: personal.getString("created"), updated: personal.getString("updated") }).execute();
        personal.set("moved_to", shared.id);
        personal.set("moved_circle", circle.id);
        personal.set("recurrence", "");
        app.save(personal);
        service.preserveFormerBalances(app, circle.id, members, before);
        result = app.findRecordById("circle_expenses", shared.id).publicExport();
    });
    e.response.header().set("Cache-Control", "no-store");
    return e.json(200, result);
}

module.exports = { move };
