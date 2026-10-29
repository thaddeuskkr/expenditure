/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    app.delete(app.findCollectionByNameOrId("circle_personal_moves"));
}, () => {
    throw new Error("Restore a backup with its matching application version to recover discarded Circle move receipts.");
});
