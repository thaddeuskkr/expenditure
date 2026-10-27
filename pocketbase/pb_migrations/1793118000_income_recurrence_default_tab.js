/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    for (const name of ["expenses", "circle_expenses"]) {
        const collection = app.findCollectionByNameOrId(name);
        collection.fields.add(new SelectField({ name: "kind", values: ["expense", "income"], maxSelect: 1 }));
        collection.fields.add(new SelectField({ name: "recurrence", values: ["daily", "weekly", "monthly", "yearly"], maxSelect: 1 }));
        collection.fields.add(new TextField({ name: "recurrence_timezone", max: 80 }));
        collection.fields.add(new TextField({ name: "recurrence_anchor", max: 19 }));
        collection.fields.add(new TextField({ name: "recurrence_next", max: 30 }));
        collection.fields.add(new TextField({ name: "recurrence_error", max: 300 }));
        app.save(collection);
        app.db().newQuery("UPDATE " + name + " SET kind = 'expense'").execute();
        collection.fields.getByName("kind").required = true;
        collection.indexes.push("CREATE INDEX idx_" + name + "_recurrence ON " + name + " (recurrence_next) WHERE recurrence != ''");
        app.save(collection);
    }

    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.add(new SelectField({ name: "default_tab", values: ["Overview", "Transactions", "Categories", "Budgets", "Circles", "API keys", "Settings"], maxSelect: 1 }));
    app.save(preferences);
    app.db().newQuery("UPDATE preferences SET default_tab = 'Overview'").execute();
    preferences.fields.getByName("default_tab").required = true;
    app.save(preferences);
}, (app) => {
    for (const name of ["expenses", "circle_expenses"]) {
        const collection = app.findCollectionByNameOrId(name);
        collection.indexes = collection.indexes.filter((index) => index.indexOf("idx_" + name + "_recurrence") < 0);
        for (const field of ["kind", "recurrence", "recurrence_timezone", "recurrence_anchor", "recurrence_next", "recurrence_error"]) collection.fields.removeByName(field);
        app.save(collection);
    }

    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.removeByName("default_tab");
    app.save(preferences);
});
