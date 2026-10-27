routerAdd("POST", "/api/expenditure/circles/{id}/expenses/move", (e) => require(`${__hooks}/expense-moves.js`).move(e), $apis.requireAuth("users"), $apis.bodyLimit(4096));
