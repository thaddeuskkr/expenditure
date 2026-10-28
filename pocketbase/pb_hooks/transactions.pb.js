/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/expenditure/transactions", (e) => {
    const result = require(`${__hooks}/transactions.js`).list(e.app, e.auth.id, e.request.url.query());
    e.response.header().set("Cache-Control", "no-store");
    return e.json(200, result);
}, $apis.requireAuth("users"));
