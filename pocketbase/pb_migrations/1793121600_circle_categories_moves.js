/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const circles = app.findCollectionByNameOrId("circles");
    const categories = new Collection({
        name: "circle_categories", type: "base",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
            { name: "circle", type: "relation", collectionId: circles.id, required: true, maxSelect: 1, cascadeDelete: true },
            { name: "name", type: "text", required: true, max: 60 },
            { name: "color", type: "text", required: true, max: 7 },
            { name: "active", type: "bool" },
            { name: "sort_order", type: "number", onlyInt: true, min: 0 },
            { name: "created", type: "autodate", onCreate: true },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_circle_category_name ON circle_categories (circle, lower(name))"],
    });
    app.save(categories);
    const names = ["Food & drinks", "Groceries", "Transport", "Shopping", "Entertainment", "Bills & utilities", "Health", "Other"];
    const colors = ["#bfc9a4", "#8dada0", "#b7b9cf", "#d6b79a", "#a8b6c5", "#c9c293", "#c3a4af", "#999d94"];
    app.findRecordsByFilter("circles", "", "", 0, 0).forEach((circle) => {
        names.forEach((name, index) => {
            const record = new Record(categories);
            record.load({ circle: circle.id, name, color: colors[index], active: true, sort_order: index });
            app.save(record);
        });
    });
    const shared = app.findCollectionByNameOrId("circle_expenses");
    shared.fields.add(new TextField({ name: "category", max: 60 }));
    shared.fields.add(new SelectField({ name: "source", values: ["manual", "api"], maxSelect: 1 }));
    shared.fields.add(new TextField({ name: "origin_expense", max: 15 }));
    app.save(shared);
    app.db().newQuery("UPDATE circle_expenses SET category = 'Other', source = 'manual'").execute();
    shared.fields.getByName("category").required = true;
    shared.fields.getByName("source").required = true;
    app.save(shared);

    const personal = app.findCollectionByNameOrId("expenses");
    // An immutable receipt retains API retry markers even after transfer/deletion
    // of the Circle entry. It is excluded from all personal lists and reports.
    personal.fields.add(new TextField({ name: "moved_to", max: 15 }));
    personal.fields.add(new TextField({ name: "moved_circle", max: 15 }));
    for (const rule of ["listRule", "viewRule", "updateRule", "deleteRule"]) {
        personal[rule] = "(" + personal[rule] + ") && moved_to = ''";
    }

    app.save(personal);
}, (app) => {
    const personal = app.findCollectionByNameOrId("expenses");
    // Do not resurrect transferred rows in the personal ledger on rollback.
    app.db().newQuery("DELETE FROM expenses WHERE moved_to != ''").execute();
    for (const rule of ["listRule", "viewRule", "updateRule", "deleteRule"]) {
        personal[rule] = personal[rule].slice(1, -") && moved_to = ''".length);
    }

    personal.fields.removeByName("moved_to");
    personal.fields.removeByName("moved_circle");
    app.save(personal);
    const shared = app.findCollectionByNameOrId("circle_expenses");
    for (const field of ["category", "source", "origin_expense"]) shared.fields.removeByName(field);
    app.save(shared);
    app.delete(app.findCollectionByNameOrId("circle_categories"));
});
