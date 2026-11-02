/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.add(new JSONField({ name: "payment_methods", maxSize: 32768 }));
    app.save(preferences);
    // Initialize choices without resaving records or changing any ledger labels.
    app.db().newQuery("UPDATE preferences SET payment_methods = '[]'").execute();
}, (app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.removeByName("payment_methods");
    app.save(preferences);
});
