/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // The standalone API page moved into Settings. Preserve account timestamps
    // and all key/ledger records while updating the obsolete landing-page choice.
    app.db().newQuery("UPDATE preferences SET default_tab = 'Settings' WHERE default_tab = 'API keys'").execute();
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.getByName("default_tab").values = ["Overview", "Transactions", "Categories", "Budgets", "Circles", "Settings"];
    app.save(preferences);
}, (app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    preferences.fields.getByName("default_tab").values = ["Overview", "Transactions", "Categories", "Budgets", "Circles", "API keys", "Settings"];
    app.save(preferences);
});
