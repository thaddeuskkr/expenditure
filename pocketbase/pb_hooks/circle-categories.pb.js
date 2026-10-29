onRecordValidate((e) => {
    if (e.record.isNew()) {
        if (!e.record.getString("source")) e.record.set("source", "manual");
        if (!e.record.getString("category")) e.record.set("category", require(`${__hooks}/circle-categories.js`).select(e.app, e.record.getString("circle"), undefined, null));
    }

    return e.next();
}, "circle_expenses");

routerAdd("POST", "/api/expenditure/circles/{id}/categories", (e) => require(`${__hooks}/circle-categories.js`).create(e), $apis.requireAuth("users"), $apis.bodyLimit(4096));
routerAdd("PATCH", "/api/expenditure/circles/{id}/categories/{category}", (e) => require(`${__hooks}/circle-categories.js`).update(e), $apis.requireAuth("users"), $apis.bodyLimit(4096));
routerAdd("POST", "/api/expenditure/circles/{id}/categories/reorder", (e) => require(`${__hooks}/circle-categories.js`).reorder(e), $apis.requireAuth("users"), $apis.bodyLimit(8192));
routerAdd("POST", "/api/expenditure/circles/{id}/categories/copy", (e) => require(`${__hooks}/circle-categories.js`).copy(e), $apis.requireAuth("users"), $apis.bodyLimit(8192));
