/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const members = app.findCollectionByNameOrId("circle_members");
    members.fields.add(new BoolField({ name: "is_admin" }));
    members.fields.add(new BoolField({ name: "can_add" }));
    for (const name of ["edit_scope", "delete_scope"])
        members.fields.add(new SelectField({ name, values: ["none", "own", "all"], required: true, maxSelect: 1 }));
    members.fields.add(new NumberField({ name: "version", onlyInt: true, required: true, min: 1 }));
    app.save(members);
    // Preserve membership and ledger timestamps, IDs, balances and schedule cursors.
    app.db().newQuery("UPDATE circle_members SET is_admin = FALSE, can_add = TRUE, edit_scope = 'own', delete_scope = 'own', version = 1").execute();
}, (app) => {
    const members = app.findCollectionByNameOrId("circle_members");
    for (const name of ["is_admin", "can_add", "edit_scope", "delete_scope", "version"]) members.fields.removeByName(name);
    app.save(members);
});
