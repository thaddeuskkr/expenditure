/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/expenditure/status", (e) => e.json(200, { version: 2 }));

routerAdd(
  "GET",
  "/api/expenditure/keys",
  (e) => {
    const lib = require(`${__hooks}/expenditure.js`);
    e.response.header().set("Cache-Control", "no-store");
    const keys = e.app.findRecordsByFilter(
      "api_keys",
      "user = {:user}",
      "-created",
      100,
      0,
      { user: e.auth.id },
    );
    return e.json(200, { items: keys.map(lib.cleanKey) });
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/expenditure/keys",
  (e) => {
    const lib = require(`${__hooks}/expenditure.js`);
    const data = e.requestInfo().body;
    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.trim().length > 80
    )
      throw new BadRequestError("Enter a key name (up to 80 characters).");
    const scopes = data.scopes;
    if (
      !Array.isArray(scopes) ||
      scopes.length < 1 ||
      scopes.length > 2 ||
      scopes.some((s) => ["expenses:read", "expenses:write"].indexOf(s) < 0) ||
      (scopes.length === 2 && scopes[0] === scopes[1])
    )
      throw new BadRequestError("Select valid scopes.");
    const days = data.expires_in_days;
    if ([30, 90, 365].indexOf(days) < 0)
      throw new BadRequestError("Expiration must be 30, 90 or 365 days.");
    let result;
    e.app.runInTransaction((app) => {
      const count = app.countRecords(
        "api_keys",
        $dbx.exp("user = {:user} AND revoked_at = '' AND expires_at > {:now}", {
          user: e.auth.id,
          now: new Date().toISOString().replace("T", " "),
        }),
      );
      if (count >= 20)
        throw new BadRequestError(
          "You can have up to 20 active keys. Revoke a key first.",
        );
      // Retain a bounded history, so the management list remains complete.
      const history = app.findRecordsByFilter(
        "api_keys",
        "user = {:user}",
        "created",
        0,
        0,
        { user: e.auth.id },
      );
      if (history.length >= 100) {
        const inactive = history.filter(
          (record) =>
            record.getString("revoked_at") ||
            (record.getString("expires_at") &&
              new Date(record.getString("expires_at")).getTime() <= Date.now()),
        );
        inactive
          .slice(0, history.length - 99)
          .forEach((record) => app.delete(record));
      }
      const secret = "exp_" + $security.randomString(48);
      const record = new Record(app.findCollectionByNameOrId("api_keys"));
      record.load({
        user: e.auth.id,
        name: data.name.trim(),
        key_hash: $security.sha256(secret),
        key_prefix: secret.slice(0, 12),
        scopes,
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
      });
      app.save(record);
      result = { key: secret, record: lib.cleanKey(record) };
    });
    e.response.header().set("Cache-Control", "no-store");
    return e.json(201, result);
  },
  $apis.requireAuth("users"),
  $apis.bodyLimit(4096),
);

routerAdd(
  "DELETE",
  "/api/expenditure/keys/{id}",
  (e) => {
    let key;
    try {
      key = e.app.findFirstRecordByFilter(
        "api_keys",
        "id = {:id} && user = {:user}",
        { id: e.request.pathValue("id"), user: e.auth.id },
      );
    } catch (_) {
      throw new NotFoundError("API key not found.");
    }
    key.set("revoked_at", new Date().toISOString());
    e.app.save(key);
    return e.json(200, { revoked: true });
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/expenses/transactions",
  (e) => {
    const lib = require(`${__hooks}/expenditure.js`);
    const identity = lib.authenticate(e, "expenses:write");
    const data = e.requestInfo().body;
    if (data.user !== undefined)
      throw new BadRequestError(
        "Ownership is determined by your API key; omit user.",
      );
    const fields = lib.validateExpense(data, e.app, identity.user.id);
    const idempotency = e.request.header.get("Idempotency-Key");
    if (idempotency && !/^[A-Za-z0-9_.:-]{1,128}$/.test(idempotency))
      throw new BadRequestError("Invalid Idempotency-Key.");
    let record,
      replay = false;
    e.app.runInTransaction((app) => {
      if (idempotency) {
        const existing = app.findRecordsByFilter(
          "expenses",
          "user = {:user} && idempotency_key = {:key}",
          "",
          1,
          0,
          { user: identity.user.id, key: idempotency },
        );
        if (existing.length) {
          record = existing[0];
          const equal = [
            "merchant",
            "amount_cents",
            "currency",
            "category",
            "notes",
            "card",
          ].every(
            (field) => String(record.get(field)) === String(fields[field]),
          );
          if (
            !equal ||
            (data.occurred_at !== undefined &&
              new Date(record.getString("occurred_at")).getTime() !==
                new Date(fields.occurred_at).getTime())
          )
            throw new ApiError(
              409,
              "Idempotency-Key was already used with different data.",
            );
          replay = true;
          return;
        }
      }
      record = new Record(app.findCollectionByNameOrId("expenses"));
      record.load(fields);
      record.load({
        user: identity.user.id,
        source: "api",
        idempotency_key: idempotency || "",
      });
      app.save(record);
    });
    lib.touch(e.app, identity.key);
    return e.json(replay ? 200 : 201, {
      ...record.publicExport(),
      amount_minor: record.getInt("amount_cents"),
      replay,
    });
  },
  $apis.bodyLimit(8192),
);

routerAdd("GET", "/api/expenses/transactions", (e) => {
  const lib = require(`${__hooks}/expenditure.js`);
  const identity = lib.authenticate(e, "expenses:read");
  const query = e.request.url.query();
  const page = Math.max(
    1,
    Math.min(100000, parseInt(query.get("page"), 10) || 1),
  );
  const perPage = Math.max(
    1,
    Math.min(100, parseInt(query.get("perPage"), 10) || 30),
  );
  const params = { user: identity.user.id };
  const records = e.app.findRecordsByFilter(
    "expenses",
    "user = {:user}",
    "-occurred_at,-created",
    perPage,
    (page - 1) * perPage,
    params,
  );
  const total = e.app.countRecords(
    "expenses",
    $dbx.hashExp({ user: identity.user.id }),
  );
  lib.touch(e.app, identity.key);
  return e.json(200, {
    items: records.map((record) => ({
      ...record.publicExport(),
      amount_minor: record.getInt("amount_cents"),
    })),
    page,
    perPage,
    totalItems: total,
    totalPages: Math.ceil(total / perPage),
  });
});

routerAdd(
  "GET",
  "/api/expenditure/overview",
  (e) => {
    const lib = require(`${__hooks}/expenditure.js`);
    const range = lib.bounds(e.request.url.query());
    const result = require(`${__hooks}/overview.js`).summarize(
      e.app,
      e.auth.id,
      range,
    );
    e.response.header().set("Cache-Control", "no-store");
    return e.json(200, result);
  },
  $apis.requireAuth("users"),
);

// Native collection calls also preserve source provenance and enforce invariants.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set("source", "manual");
    e.record.set("idempotency_key", "");
  }
  return e.next();
}, "expenses");

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set("source", e.record.original().getString("source"));
    e.record.set(
      "idempotency_key",
      e.record.original().getString("idempotency_key"),
    );
  }
  return e.next();
}, "expenses");
