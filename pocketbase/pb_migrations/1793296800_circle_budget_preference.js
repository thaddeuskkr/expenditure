/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.add(new BoolField({ name: "include_circle_in_budgets" }));
    app.save(preferences);
    app.db().newQuery("UPDATE preferences SET include_circle_in_budgets = TRUE").execute();
}, (app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.removeByName("include_circle_in_budgets");
    app.save(preferences);
});
