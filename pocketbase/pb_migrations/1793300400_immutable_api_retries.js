/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.add(new JSONField({ name: "idempotency_data", hidden: true, maxSize: 16384 }));
    app.save(expenses);
    // Earlier request bodies are unavailable. Seed existing markers from their
    // saved records, including moved receipts, without resaving ledger history.
    app.db().newQuery(`UPDATE expenses SET idempotency_data = json_object(
        'merchant', merchant, 'amount', amount, 'currency', currency,
        'category', category, 'notes', notes, 'payment_method', payment_method,
        'occurred_at', occurred_at
    ) WHERE idempotency_key != ''`).execute();
}, (app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.removeByName("idempotency_data");
    app.save(expenses);
});
