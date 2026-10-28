/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.add(new BoolField({ name: "show_circle_transactions" }));
    app.save(preferences);
}, (app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.removeByName("show_circle_transactions");
    app.save(preferences);
});
