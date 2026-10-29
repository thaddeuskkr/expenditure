/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const members = app.findCollectionByNameOrId("circle_members");
    members.fields.add(new SelectField({ name: "move_scope", values: ["none", "payer", "all"], required: true, maxSelect: 1 }));
    app.save(members);
    // Preserve membership and ledger history without resaving records.
    app.db().newQuery("UPDATE circle_members SET move_scope = CASE WHEN edit_scope = 'none' THEN 'none' ELSE 'payer' END").execute();
}, (app) => {
    const members = app.findCollectionByNameOrId("circle_members");
    members.fields.removeByName("move_scope");
    app.save(members);
});
