/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        const collection = app.findCollectionByNameOrId("categories");
        collection.fields.add(new NumberField({ name: "sort_order", min: 0, onlyInt: true }));
        app.save(collection);
        // Preserve each account's existing displayed order, including archived rows.
        app.db().newQuery(`
            WITH ordered AS (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY user ORDER BY created, name, id
                ) - 1 AS position FROM categories
            )
            UPDATE categories SET sort_order = (
                SELECT position FROM ordered WHERE ordered.id = categories.id
            )
        `).execute();
    },
    (app) => {
        const collection = app.findCollectionByNameOrId("categories");
        collection.fields.removeById(collection.fields.getByName("sort_order").id);
        app.save(collection);
    },
);
