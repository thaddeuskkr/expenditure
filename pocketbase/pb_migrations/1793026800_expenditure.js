/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const owner = '@request.auth.id != "" && user = @request.auth.id';
    const create =
      '@request.auth.id != "" && @request.body.user = @request.auth.id';
    const update =
      owner +
      " && (@request.body.user:isset = false || @request.body.user = @request.auth.id)";
    const categories = [
      "Food & drinks",
      "Groceries",
      "Transport",
      "Shopping",
      "Entertainment",
      "Bills & utilities",
      "Health",
      "Other",
    ];
    const currencies = ["SGD", "USD", "EUR", "GBP", "AUD", "MYR"];
    function fields() {
      return [
        {
          name: "user",
          type: "relation",
          collectionId: users.id,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ];
    }
    function save(name, extra, indexes) {
      app.save(
        new Collection({
          name,
          type: "base",
          listRule: owner,
          viewRule: owner,
          createRule: create,
          updateRule: update,
          deleteRule: owner,
          fields: fields().concat(extra),
          indexes: indexes || [],
        }),
      );
    }
    save(
      "expenses",
      [
        { name: "merchant", type: "text", required: true, max: 160 },
        {
          name: "amount_cents",
          type: "number",
          required: true,
          onlyInt: true,
          min: 1,
          max: 99999999999,
        },
        {
          name: "currency",
          type: "select",
          required: true,
          maxSelect: 1,
          values: currencies,
        },
        {
          name: "category",
          type: "select",
          required: true,
          maxSelect: 1,
          values: categories,
        },
        { name: "occurred_at", type: "date", required: true },
        { name: "notes", type: "text", max: 2000 },
        { name: "card", type: "text", max: 80 },
        {
          name: "source",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["manual", "api"],
        },
        { name: "idempotency_key", type: "text", max: 128, hidden: true },
      ],
      [
        "CREATE INDEX idx_expenses_owner_date ON expenses (user, currency, occurred_at)",
        "CREATE UNIQUE INDEX idx_expenses_idempotency ON expenses (user, idempotency_key) WHERE idempotency_key != ''",
      ],
    );
    save(
      "budgets",
      [
        {
          name: "month",
          type: "text",
          required: true,
          pattern: "^\\d{4}-(0[1-9]|1[0-2])$",
        },
        {
          name: "category",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["Overall"].concat(categories),
        },
        {
          name: "currency",
          type: "select",
          required: true,
          maxSelect: 1,
          values: currencies,
        },
        {
          name: "amount_cents",
          type: "number",
          required: true,
          onlyInt: true,
          min: 1,
          max: 99999999999,
        },
      ],
      [
        "CREATE UNIQUE INDEX idx_budgets_owner_month ON budgets (user, month, currency, category)",
      ],
    );
    save(
      "preferences",
      [
        {
          name: "currency",
          type: "select",
          required: true,
          maxSelect: 1,
          values: currencies,
        },
        {
          name: "timezone",
          type: "select",
          required: true,
          maxSelect: 1,
          values: [
            "Asia/Singapore",
            "UTC",
            "Asia/Kuala_Lumpur",
            "Australia/Sydney",
            "Europe/London",
            "America/New_York",
            "America/Los_Angeles",
          ],
        },
      ],
      ["CREATE UNIQUE INDEX idx_preferences_owner ON preferences (user)"],
    );
    app.save(
      new Collection({
        name: "api_keys",
        type: "base",
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: fields().concat([
          { name: "name", type: "text", required: true, max: 80 },
          { name: "key_hash", type: "text", required: true, hidden: true },
          { name: "key_prefix", type: "text", required: true },
          {
            name: "scopes",
            type: "select",
            required: true,
            maxSelect: 2,
            values: ["expenses:read", "expenses:write"],
          },
          { name: "expires_at", type: "date" },
          { name: "revoked_at", type: "date" },
          { name: "last_used", type: "date" },
        ]),
        indexes: [
          "CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys (key_hash)",
          "CREATE INDEX idx_api_keys_owner ON api_keys (user)",
        ],
      }),
    );
  },
  (app) => {
    ["api_keys", "preferences", "budgets", "expenses"].forEach((name) =>
      app.delete(app.findCollectionByNameOrId(name)),
    );
  },
);
