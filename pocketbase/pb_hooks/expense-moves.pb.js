routerAdd("POST", "/api/expenditure/circles/{id}/expenses/move", (e) => require(`${__hooks}/expense-moves.js`).move(e), $apis.requireAuth("users"), $apis.bodyLimit(4096));
routerAdd("POST", "/api/expenditure/circles/{id}/expenses/{expense}/move-to-personal", (e) => require(`${__hooks}/expense-moves.js`).moveToPersonal(e), $apis.requireAuth("users"), $apis.bodyLimit(4096));
