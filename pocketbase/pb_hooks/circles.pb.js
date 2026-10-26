// Each handler loads its module inside PocketBase's isolated callback scope.
routerAdd(
    "GET",
    "/api/expenditure/circles",
    (e) => require(`${__hooks}/circles-service.js`).list(e),
    $apis.requireAuth("users"),
);
routerAdd(
    "POST",
    "/api/expenditure/circles",
    (e) => require(`${__hooks}/circles-service.js`).create(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(4096),
);
routerAdd(
    "GET",
    "/api/expenditure/circles/{id}",
    (e) => require(`${__hooks}/circles-service.js`).detail(e),
    $apis.requireAuth("users"),
);
routerAdd(
    "PATCH",
    "/api/expenditure/circles/{id}",
    (e) => require(`${__hooks}/circles-service.js`).update(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(4096),
);
routerAdd(
    "DELETE",
    "/api/expenditure/circles/{id}",
    (e) => require(`${__hooks}/circles-service.js`).remove(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(4096),
);
routerAdd(
    "POST",
    "/api/expenditure/circles/{id}/invitations",
    (e) => require(`${__hooks}/circles-service.js`).invite(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(4096),
);
routerAdd(
    "GET",
    "/api/expenditure/circle-invitations/{invitation}",
    (e) => require(`${__hooks}/circles-service.js`).previewInvitation(e),
    $apis.requireAuth("users"),
);
routerAdd(
    "POST",
    "/api/expenditure/circle-invitations/{invitation}/accept",
    (e) => require(`${__hooks}/circles-service.js`).acceptInvitation(e),
    $apis.requireAuth("users"),
);
routerAdd(
    "DELETE",
    "/api/expenditure/circle-invitations/{invitation}",
    (e) => require(`${__hooks}/circles-service.js`).revokeInvitation(e),
    $apis.requireAuth("users"),
);
routerAdd(
    "DELETE",
    "/api/expenditure/circles/{id}/members/{member}",
    (e) => require(`${__hooks}/circles-service.js`).removeMember(e),
    $apis.requireAuth("users"),
);
routerAdd(
    "POST",
    "/api/expenditure/circles/{id}/expenses",
    (e) => require(`${__hooks}/circles-service.js`).saveExpense(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(16384),
);
routerAdd(
    "PATCH",
    "/api/expenditure/circles/{id}/expenses/{expense}",
    (e) => require(`${__hooks}/circles-service.js`).saveExpense(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(16384),
);
routerAdd(
    "DELETE",
    "/api/expenditure/circles/{id}/expenses/{expense}",
    (e) => require(`${__hooks}/circles-service.js`).deleteExpense(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(4096),
);
routerAdd(
    "POST",
    "/api/expenditure/circles/{id}/settlements",
    (e) => require(`${__hooks}/circles-service.js`).settle(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(8192),
);
routerAdd(
    "DELETE",
    "/api/expenditure/circles/{id}/settlements/{settlement}",
    (e) => require(`${__hooks}/circles-service.js`).deleteSettlement(e),
    $apis.requireAuth("users"),
    $apis.bodyLimit(4096),
);

onRecordDelete((e) => {
    require(`${__hooks}/circles-service.js`).deleteContents(e.app, e.record.id);
    return e.next();
}, "circles");
