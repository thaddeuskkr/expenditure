/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const expenses = app.findCollectionByNameOrId("circle_expenses");
    expenses.fields.add(new JSONField({ name: "receipt", maxSize: 200000 }));
    app.save(expenses);
}, (app) => {
    const expenses = app.findCollectionByNameOrId("circle_expenses");
    expenses.fields.removeByName("receipt");
    app.save(expenses);
});
