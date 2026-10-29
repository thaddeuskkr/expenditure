/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const users = app.findCollectionByNameOrId("users");
    const receipts = new Collection({
        name: "api_transaction_retries", type: "base",
        listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [
            { name: "user", type: "relation", collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true },
            { name: "key", type: "text", required: true, max: 128 },
            // Text references retain retry protection after a ledger/Circle is deleted.
            { name: "circle", type: "text", max: 15 },
            { name: "transaction", type: "text", required: true, max: 15 },
            { name: "request", type: "json", required: true, maxSize: 16384 },
            // Copy the ledger's server-created instant exactly, rather than
            // starting a second clock a few milliseconds after the expense.
            { name: "created", type: "date", required: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_api_retry_user_key ON api_transaction_retries (user, key)", "CREATE INDEX idx_api_retry_created ON api_transaction_retries (created)"],
    });
    app.save(receipts);
    // Keep existing request snapshots and original retry windows, including moved
    // personal receipts. Never resave the financial records during this upgrade.
    app.db().newQuery(`INSERT INTO api_transaction_retries (id, user, key, circle, "transaction", request, created)
        SELECT id, user, idempotency_key, '', id, idempotency_data, created
        FROM expenses WHERE idempotency_key != ''`).execute();
}, (app) => {
    app.delete(app.findCollectionByNameOrId("api_transaction_retries"));
});
