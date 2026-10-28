/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    for (const name of ["expenses", "circle_expenses"]) {
        const collection = app.findCollectionByNameOrId(name);
        collection.fields.add(new JSONField({ name: "recurrence_weekdays", maxSize: 128 }));
        collection.fields.add(new NumberField({ name: "recurrence_month", min: 0, max: 12, onlyInt: true }));
        app.save(collection);
        // Empty weekdays and month 0 keep the entry's original weekday/month.
        // Do not resave records: active and paused cursors must stay untouched.
        app.db().newQuery("UPDATE " + name + " SET recurrence_weekdays = '[]'").execute();
    }
}, (app) => {
    for (const name of ["expenses", "circle_expenses"]) {
        const collection = app.findCollectionByNameOrId(name);
        for (const field of ["recurrence_weekdays", "recurrence_month"]) collection.fields.removeByName(field);
        app.save(collection);
    }
});
