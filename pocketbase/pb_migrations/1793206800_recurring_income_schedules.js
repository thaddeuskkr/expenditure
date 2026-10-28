/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    for (const name of ["expenses", "circle_expenses"]) {
        const collection = app.findCollectionByNameOrId(name);
        collection.fields.add(new NumberField({ name: "recurrence_interval", min: 0, max: 365, onlyInt: true }));
        collection.fields.add(new NumberField({ name: "recurrence_day", min: -1, max: 31, onlyInt: true }));
        app.save(collection);
        // Preserve every existing cursor, anchor, timestamp and ledger value.
        app.db().newQuery("UPDATE " + name + " SET recurrence_interval = 1 WHERE recurrence != ''").execute();
    }
}, (app) => {
    for (const name of ["expenses", "circle_expenses"]) {
        const collection = app.findCollectionByNameOrId(name);
        for (const field of ["recurrence_interval", "recurrence_day"]) collection.fields.removeByName(field);
        app.save(collection);
    }
});
