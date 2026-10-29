/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    // Empty means personal. Retain an unavailable Circle ID so API calls fail
    // explicitly instead of changing destinations after deletion or removal.
    preferences.fields.add(new TextField({ name: "default_api_circle", max: 15, pattern: "^([a-z0-9]{15})?$" }));
    app.save(preferences);
}, (app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.removeByName("default_api_circle");
    app.save(preferences);
});
