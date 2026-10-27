/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        function rename(collectionName, previous, next) {
            const collection = app.findCollectionByNameOrId(collectionName);
            collection.fields.getByName(previous).name = next;
            app.save(collection);
        }

        rename("expenses", "amount_cents", "amount");
        rename("expenses", "card", "payment_method");
        rename("budgets", "amount_cents", "amount");
        rename("circle_expenses", "amount_minor", "amount");
        rename("circle_settlements", "amount_minor", "amount");
        // Update saved allocations without changing any ledger amounts,
        // percentage weights, expense IDs or timestamps.
        app.db().newQuery(`
            UPDATE circle_expenses SET shares = (
                SELECT json_group_array(json_remove(
                    json_set(value, '$.amount', json_extract(value, '$.amount_minor')),
                    '$.amount_minor'
                )) FROM json_each(circle_expenses.shares)
            )
        `).execute();
    },
    (app) => {
        function rename(collectionName, previous, next) {
            const collection = app.findCollectionByNameOrId(collectionName);
            collection.fields.getByName(previous).name = next;
            app.save(collection);
        }

        app.db().newQuery(`
            UPDATE circle_expenses SET shares = (
                SELECT json_group_array(json_remove(
                    json_set(value, '$.amount_minor', json_extract(value, '$.amount')),
                    '$.amount'
                )) FROM json_each(circle_expenses.shares)
            )
        `).execute();
        rename("circle_settlements", "amount", "amount_minor");
        rename("circle_expenses", "amount", "amount_minor");
        rename("budgets", "amount", "amount_cents");
        rename("expenses", "payment_method", "card");
        rename("expenses", "amount", "amount_cents");
    },
);
