cronAdd("expenditure_exchange_rates", "7 * * * *", () => {
  require(`${__hooks}/exchange-rates.js`).refresh($app);
});

routerAdd(
  "GET",
  "/api/expenditure/config",
  (e) => {
    const config = require(`${__hooks}/configuration.js`);
    config.initialize(e.app, e.auth.id);
    const used = arrayOf(new DynamicModel({ currency: "" }));
    e.app
      .db()
      .newQuery(
        "SELECT DISTINCT currency FROM expenses WHERE user = {:user} UNION SELECT DISTINCT currency FROM budgets WHERE user = {:user}",
      )
      .bind({ user: e.auth.id })
      .all(used);
    e.response.header().set("Cache-Control", "no-store");
    return e.json(200, {
      preferences: config.preferences(e.app, e.auth.id),
      categories: config.categories(e.app, e.auth.id),
      used_currencies: used.map((r) => r.currency),
    });
  },
  $apis.requireAuth("users"),
);

routerAdd(
  "POST",
  "/api/expenditure/categories",
  (e) => {
    const config = require(`${__hooks}/configuration.js`);
    config.initialize(e.app, e.auth.id);
    const data = e.requestInfo().body;
    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.trim().length > 60 ||
      ["overall", "all"].indexOf(data.name.trim().toLowerCase()) >= 0
    )
      throw new BadRequestError(
        "Choose a category name up to 60 characters, other than Overall or All.",
      );
    if (typeof data.color !== "string" || !/^#[a-fA-F0-9]{6}$/.test(data.color))
      throw new BadRequestError("Choose a valid color.");
    let created;
    e.app.runInTransaction((app) => {
      if (
        app.countRecords("categories", $dbx.hashExp({ user: e.auth.id })) >= 100
      )
        throw new BadRequestError("You can have up to 100 categories.");
      if (
        app.countRecords(
          "categories",
          $dbx.exp("user = {:user} AND lower(name) = lower({:name})", {
            user: e.auth.id,
            name: data.name.trim(),
          }),
        )
      )
        throw new BadRequestError("A category with this name already exists.");
      const record = new Record(app.findCollectionByNameOrId("categories"));
      record.load({
        user: e.auth.id,
        name: data.name.trim(),
        color: data.color,
        active: true,
      });
      app.save(record);
      created = record.publicExport();
    });
    return e.json(201, created);
  },
  $apis.requireAuth("users"),
  $apis.bodyLimit(4096),
);

routerAdd(
  "PATCH",
  "/api/expenditure/categories/{id}",
  (e) => {
    const data = e.requestInfo().body;
    if (
      data.name !== undefined &&
      (typeof data.name !== "string" ||
        !data.name.trim() ||
        data.name.trim().length > 60 ||
        ["overall", "all"].indexOf(data.name.trim().toLowerCase()) >= 0)
    )
      throw new BadRequestError(
        "Choose a category name up to 60 characters, other than Overall or All.",
      );
    if (
      data.color !== undefined &&
      (typeof data.color !== "string" || !/^#[a-fA-F0-9]{6}$/.test(data.color))
    )
      throw new BadRequestError("Choose a valid color.");
    if (data.active !== undefined && typeof data.active !== "boolean")
      throw new BadRequestError("Invalid category status.");
    let updated;
    e.app.runInTransaction((app) => {
      let record;
      try {
        record = app.findFirstRecordByFilter(
          "categories",
          "id = {:id} && user = {:user}",
          { id: e.request.pathValue("id"), user: e.auth.id },
        );
      } catch (_) {
        throw new NotFoundError("Category not found.");
      }
      const name =
        data.name === undefined ? record.getString("name") : data.name.trim();
      const active =
        data.active === undefined ? record.getBool("active") : data.active;
      if (
        app.countRecords(
          "categories",
          $dbx.exp(
            "user = {:user} AND id != {:id} AND lower(name) = lower({:name})",
            { user: e.auth.id, id: record.id, name },
          ),
        )
      )
        throw new BadRequestError("A category with this name already exists.");
      if (
        !active &&
        record.getBool("active") &&
        app.countRecords(
          "categories",
          $dbx.hashExp({ user: e.auth.id, active: true }),
        ) <= 1
      )
        throw new BadRequestError("Keep at least one active category.");
      const previous = record.getString("name");
      record.set("name", name);
      record.set("active", active);
      if (data.color !== undefined) record.set("color", data.color);
      app.save(record);
      // Rename atomically without changing ownership, amounts, or API provenance.
      if (previous !== name)
        ["expenses", "budgets"].forEach((table) =>
          app
            .db()
            .newQuery(
              "UPDATE " +
                table +
                " SET category = {:name}, updated = {:now} WHERE user = {:user} AND category = {:previous}",
            )
            .bind({
              user: e.auth.id,
              previous,
              name,
              now: new Date().toISOString().replace("T", " "),
            })
            .execute(),
        );
      updated = record.publicExport();
    });
    return e.json(200, updated);
  },
  $apis.requireAuth("users"),
  $apis.bodyLimit(4096),
);

routerAdd(
  "GET",
  "/api/expenditure/rates",
  (e) => {
    e.response.header().set("Cache-Control", "no-store");
    return e.json(
      200,
      require(`${__hooks}/exchange-rates.js`).refresh(e.app),
    );
  },
  $apis.requireAuth("users"),
);

onRecordValidate(
  (e) => {
    require(`${__hooks}/configuration.js`).validate(e.record, e.app);
    return e.next();
  },
  "expenses",
  "budgets",
  "preferences",
);
