/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const catalog = require(`${__hooks}/currencies.json`);
    const codes = catalog.map((c) => c.code);
    ["expenses", "budgets", "preferences"].forEach((name) => {
      const collection = app.findCollectionByNameOrId(name);
      const originalIndexes = collection.indexes.slice();
      collection.fields.getByName("currency").values = codes;
      let savedCategories;
      if (name !== "preferences") {
        if (name === "budgets")
          collection.indexes = collection.indexes.filter(
            (index) => index.indexOf("idx_budgets_owner_month") < 0,
          );
        savedCategories = arrayOf(new DynamicModel({ id: "", category: "" }));
        app
          .db()
          .newQuery("SELECT id, category FROM " + name)
          .all(savedCategories);
        const previous = collection.fields.getByName("category");
        // PocketBase forbids changing a field's type with the same id. Replace
        // the field and explicitly restore every existing value in this transaction.
        collection.fields.removeById(previous.id);
        collection.fields.add(
          new TextField({ name: "category", required: true, max: 60 }),
        );
      } else {
        collection.fields.add(
          new SelectField({
            name: "currencies",
            values: codes,
            maxSelect: codes.length,
          }),
        );
      }
      app.save(collection);
      if (savedCategories)
        savedCategories.forEach((row) =>
          app
            .db()
            .newQuery(
              "UPDATE " + name + " SET category = {:category} WHERE id = {:id}",
            )
            .bind({ id: row.id, category: row.category })
            .execute(),
        );
      if (name === "budgets") {
        collection.indexes = originalIndexes;
        app.save(collection);
      }
    });
    const users = app.findCollectionByNameOrId("users");
    const owner = '@request.auth.id != "" && user = @request.auth.id';
    app.save(
      new Collection({
        name: "categories",
        type: "base",
        listRule: owner,
        viewRule: owner,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "user",
            type: "relation",
            collectionId: users.id,
            required: true,
            maxSelect: 1,
            cascadeDelete: true,
          },
          { name: "name", type: "text", required: true, max: 60 },
          {
            name: "color",
            type: "text",
            required: true,
            pattern: "^#[a-fA-F0-9]{6}$",
          },
          { name: "active", type: "bool" },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_category_owner_name ON categories (user, lower(name))",
        ],
      }),
    );
    app.save(
      new Collection({
        name: "exchange_rates",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "data", type: "json", maxSize: 100000 },
          { name: "fetched_at", type: "date" },
          { name: "attempted_at", type: "date" },
          { name: "locked_until", type: "date" },
        ],
      }),
    );
    const cache = new Record(app.findCollectionByNameOrId("exchange_rates"));
    cache.id = "fxlatest0000000";
    cache.set("data", { quotes: { EUR: 1 }, dates: {} });
    app.save(cache);
  },
  (app) => {
    // Keep custom category/currency values on rollback; restoring the original
    // fixed enums would discard data that no longer fits their allowed values.
    app.delete(app.findCollectionByNameOrId("exchange_rates"));
    app.delete(app.findCollectionByNameOrId("categories"));
  },
);
