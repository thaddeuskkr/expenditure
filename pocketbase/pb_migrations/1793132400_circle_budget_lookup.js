/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const members = app.findCollectionByNameOrId("circle_members");
    members.indexes.push("CREATE INDEX idx_circle_members_user_circle ON circle_members (user, circle)");
    app.save(members);
}, (app) => {
    const members = app.findCollectionByNameOrId("circle_members");
    members.indexes = members.indexes.filter((index) => index.indexOf("idx_circle_members_user_circle") < 0);
    app.save(members);
});
