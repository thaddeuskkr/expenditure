/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.getByName("timezone").values = require(`${__hooks}/timezones.json`);
    app.save(preferences);
}, () => {
    // Keep expanded values on rollback so saved timezone preferences are retained.
});
