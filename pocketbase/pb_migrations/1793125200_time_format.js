/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.add(new SelectField({ name: "time_format", values: ["24h", "12h"], maxSelect: 1 }));
    app.save(preferences);
    app.db().newQuery("UPDATE preferences SET time_format = '24h'").execute();
    preferences.fields.getByName("time_format").required = true;
    app.save(preferences);
}, (app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.removeByName("time_format");
    app.save(preferences);
});
