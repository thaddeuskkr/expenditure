/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    const categories = app.findCollectionByNameOrId("categories");
    const codes = require(`${__hooks}/currencies.json`).map((currency) => currency.code);
    preferences.fields.add(new SelectField({ name: "default_entry_currency", values: codes, maxSelect: 1 }));
    ["default_expense_category", "default_income_category"].forEach((name) => {
        preferences.fields.add(new RelationField({ name, collectionId: categories.id, maxSelect: 1, cascadeDelete: false }));
    });
    // Empty defaults preserve existing form behavior without resaving account or ledger records.
    app.save(preferences);
}, (app) => {
    const preferences = app.findCollectionByNameOrId("preferences");
    ["default_entry_currency", "default_expense_category", "default_income_category"].forEach((name) => preferences.fields.removeByName(name));
    app.save(preferences);
});
