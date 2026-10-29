/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    for (const [table, categoryTable, ownerField] of [["expenses", "categories", "user"], ["budgets", "categories", "user"], ["circle_expenses", "circle_categories", "circle"]]) {
        const rows = arrayOf(new DynamicModel({ id: "", owner: "", category: "" }));
        app.db().newQuery(`SELECT id, ${ownerField} AS owner, category FROM ${table}`).all(rows);
        const categoryCollection = app.findCollectionByNameOrId(categoryTable);
        const categories = app.findRecordsByFilter(categoryTable, "", "sort_order,created,id", 0, 0);
        const exact = Object.create(null), folded = Object.create(null), nextOrder = Object.create(null);
        const key = (owner, name) => JSON.stringify([owner, name]);
        categories.forEach((item) => {
            const owner = item.getString(ownerField), name = item.getString("name");
            exact[key(owner, name)] = item;
            const normalized = key(owner, name.toLowerCase());
            folded[normalized] = folded[normalized] === undefined ? item : null;
            nextOrder[owner] = Math.max(nextOrder[owner] || 0, item.getInt("sort_order") + 1);
        });
        const assignments = rows.map((row) => {
            if (table === "budgets" && row.category === "Overall") return { id: row.id, category: "" };
            const name = row.category || "Other";
            let category = exact[key(row.owner, name)] || folded[key(row.owner, name.toLowerCase())];
            if (!category) {
                // Retain historical labels absent from the current category list.
                category = new Record(categoryCollection);
                category.load({ [ownerField]: row.owner, name, active: false, color: "#999d94", sort_order: nextOrder[row.owner] || 0 });
                app.save(category);
                exact[key(row.owner, name)] = category;
                folded[key(row.owner, name.toLowerCase())] = category;
                nextOrder[row.owner] = category.getInt("sort_order") + 1;
            }

            return { id: row.id, category: category.id };
        });
        const collection = app.findCollectionByNameOrId(table);
        const indexes = collection.indexes.slice();
        if (table === "budgets") collection.indexes = [];
        collection.fields.removeById(collection.fields.getByName("category").id);
        collection.fields.add(new RelationField({ name: "category", collectionId: categoryCollection.id, maxSelect: 1, cascadeDelete: false }));
        if (table === "expenses") {
            collection.indexes = collection.indexes.filter((index) => index.indexOf("idx_expenses_idempotency") < 0);
            collection.fields.removeByName("idempotency_key");
            collection.fields.removeByName("idempotency_data");
        }

        app.save(collection);
        assignments.forEach((row) => app.db().newQuery(`UPDATE ${table} SET category = {:category} WHERE id = {:id}`).bind(row).execute());
        collection.fields.getByName("category").required = table !== "budgets";
        if (table === "budgets") collection.indexes = indexes;
        if (table === "expenses") collection.indexes.push("CREATE INDEX idx_expenses_user_date ON expenses (user, occurred_at DESC, created DESC, id DESC) WHERE moved_to = ''");
        collection.indexes.push(`CREATE INDEX idx_${table}_category ON ${table} (category)`);
        app.save(collection);
    }

    for (const [table, index] of [
        ["circle_members", "CREATE INDEX idx_circle_members_circle_created ON circle_members (circle, created, id)"],
        ["circle_invitations", "CREATE INDEX idx_circle_invitations_circle_created ON circle_invitations (circle, created DESC)"],
        ["circle_personal_moves", "CREATE INDEX idx_circle_personal_moves_user ON circle_personal_moves (user)"],
    ]) {
        const collection = app.findCollectionByNameOrId(table);
        collection.indexes.push(index);
        app.save(collection);
    }
}, () => {
    throw new Error("Restore a backup with its matching application version to undo category relations and retry-data cleanup.");
});
