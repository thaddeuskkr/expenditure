/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    app.save(new Collection({
        name: "circle_personal_moves", type: "base",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
            { name: "user", type: "relation", collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true },
            { name: "circle", type: "text", required: true, min: 15, max: 15 },
            { name: "expense", type: "text", required: true, min: 15, max: 15 },
            { name: "personal", type: "text", required: true, min: 15, max: 15 },
            { name: "version", type: "number", required: true, onlyInt: true, min: 1 },
            { name: "requested_category", type: "text", max: 60 },
            // Keep the original receipt, shares and metadata for a lossless audit
            // without exposing another member's data through personal ledger reads.
            { name: "snapshot", type: "json", required: true, maxSize: 524288 },
            { name: "created", type: "autodate", onCreate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_circle_personal_move ON circle_personal_moves (circle, expense)"],
    }));
}, (app) => {
    app.delete(app.findCollectionByNameOrId("circle_personal_moves"));
});
