// Shared helpers are loaded inside each handler: PocketBase isolates handler scopes.
function cleanKey(record) {
  return {
    id: record.id,
    name: record.getString("name"),
    key_prefix: record.getString("key_prefix"),
    scopes: record.getStringSlice("scopes"),
    created: record.getString("created"),
    expires_at: record.getString("expires_at"),
    revoked_at: record.getString("revoked_at"),
    last_used: record.getString("last_used"),
  };
}

function authenticate(e, scope) {
  const secret = e.request.header.get("X-API-Key");
  if (!/^exp_[A-Za-z0-9]{48}$/.test(secret))
    throw new UnauthorizedError("Invalid API key.");
  let key;
  try {
    key = e.app.findFirstRecordByData(
      "api_keys",
      "key_hash",
      $security.sha256(secret),
    );
  } catch (_) {
    throw new UnauthorizedError("Invalid API key.");
  }
  if (
    !$security.equal(key.getString("key_hash"), $security.sha256(secret)) ||
    key.getString("revoked_at") ||
    (key.getString("expires_at") &&
      new Date(key.getString("expires_at")).getTime() <= Date.now())
  ) {
    throw new UnauthorizedError("This API key is expired or revoked.");
  }
  if (key.getStringSlice("scopes").indexOf(scope) === -1)
    throw new ForbiddenError("This API key does not have the required scope.");
  // Resolve the relation so deleted users can never retain access through a key.
  const user = e.app.findRecordById("users", key.getString("user"));
  e.response.header().set("Cache-Control", "no-store");
  return { key, user };
}

function touch(app, key) {
  // A stale Record save could undo a concurrent revocation. Update only usage
  // metadata, and throttle writes to once per minute per key.
  app
    .db()
    .newQuery(
      "UPDATE api_keys SET last_used = {:now}, updated = {:now} WHERE id = {:id} AND (last_used = '' OR last_used < {:before})",
    )
    .bind({
      id: key.id,
      now: new Date().toISOString().replace("T", " "),
      before: new Date(Date.now() - 60000).toISOString().replace("T", " "),
    })
    .execute();
}

function validateExpense(data, app, user) {
  const config = require(`${__hooks}/configuration.js`);
  const preferences = config.preferences(app, user);
  const code = data.currency || preferences.currency;
  const definition = config.currency(code);
  if (
    !data ||
    typeof data.merchant !== "string" ||
    !data.merchant.trim() ||
    data.merchant.trim().length > 160
  )
    throw new BadRequestError("Merchant is required (up to 160 characters).");
  if (
    data.amount_cents !== undefined &&
    data.amount_minor !== undefined &&
    data.amount_cents !== data.amount_minor
  )
    throw new BadRequestError("amount_minor and amount_cents must agree.");
  if (data.amount_minor === undefined && definition && definition.digits !== 2)
    throw new BadRequestError(
      "Use amount_minor for currencies that do not have two decimal places.",
    );
  const amount =
    data.amount_minor === undefined ? data.amount_cents : data.amount_minor;
  if (
    typeof amount !== "number" ||
    !isFinite(amount) ||
    amount !== Math.floor(amount) ||
    amount < 1 ||
    amount > 99999999999
  )
    throw new BadRequestError(
      "amount_minor must be a positive integer, up to 99999999999.",
    );
  if (!definition) throw new BadRequestError("Unsupported currency.");
  if (preferences.currencies.indexOf(code) < 0)
    throw new BadRequestError("Enable this currency in Settings first.");
  const available = config.categories(app, user).filter((c) => c.active);
  const fallback =
    available.filter((c) => c.name === "Other")[0] || available[0];
  const category = config.category(
    app,
    user,
    data.category === undefined ? fallback.name : data.category,
    false,
  );
  const occurred =
    data.occurred_at === undefined
      ? new Date().toISOString()
      : data.occurred_at;
  const match =
    typeof occurred === "string" &&
    occurred.match(
      /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/,
    );
  if (!match || !isFinite(new Date(occurred).getTime()))
    throw new BadRequestError(
      "occurred_at must be an ISO 8601 date with a timezone.",
    );
  const local = match[1] + "T" + match[2] + ":" + (match[3] || "00");
  const localDate = new Date(local + "Z");
  if (
    !isFinite(localDate.getTime()) ||
    localDate.toISOString().slice(0, 19) !== local
  )
    throw new BadRequestError("occurred_at contains an invalid calendar date.");
  if (
    data.notes !== undefined &&
    (typeof data.notes !== "string" || data.notes.length > 2000)
  )
    throw new BadRequestError("Notes must be at most 2000 characters.");
  if (
    data.card !== undefined &&
    (typeof data.card !== "string" || data.card.length > 80)
  )
    throw new BadRequestError("Card must be at most 80 characters.");
  return {
    merchant: data.merchant.trim(),
    amount_cents: amount,
    currency: code,
    category,
    occurred_at: new Date(occurred).toISOString(),
    notes: data.notes || "",
    card: data.card || "",
  };
}

function bounds(query) {
  const from = query.get("from"),
    to = query.get("to"),
    previous = query.get("previous");
  const fromDate = new Date(from),
    toDate = new Date(to),
    previousDate = new Date(previous);
  if (
    !from ||
    !to ||
    !previous ||
    !isFinite(fromDate.getTime()) ||
    !isFinite(toDate.getTime()) ||
    !isFinite(previousDate.getTime()) ||
    toDate <= fromDate ||
    fromDate <= previousDate ||
    toDate - previousDate > 64 * 86400000
  )
    throw new BadRequestError("Provide a valid monthly date range.");
  const currency = query.get("currency") || "all";
  if (
    currency !== "all" &&
    !require(`${__hooks}/configuration.js`).currency(currency)
  )
    throw new BadRequestError("Unsupported currency.");
  // Match PocketBase's normalized date representation for indexed comparisons.
  function pbDate(date) {
    return date.toISOString().replace("T", " ");
  }
  return {
    from: pbDate(fromDate),
    to: pbDate(toDate),
    previous: pbDate(previousDate),
    currency,
  };
}

module.exports = {
  cleanKey,
  authenticate,
  touch,
  validateExpense,
  bounds,
};
