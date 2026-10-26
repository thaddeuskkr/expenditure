/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        const users = app.findCollectionByNameOrId("users");
        function relation(name, collection, required, cascadeDelete) {
            return {
                name,
                type: "relation",
                collectionId: collection.id,
                required,
                maxSelect: 1,
                cascadeDelete,
            };
        }

        function collection(name, fields, indexes) {
            const record = new Collection({
                name,
                type: "base",
                listRule: null,
                viewRule: null,
                createRule: null,
                updateRule: null,
                deleteRule: null,
                fields: fields.concat([
                    { name: "created", type: "autodate", onCreate: true },
                    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
                ]),
                indexes,
            });
            app.save(record);
            return record;
        }

        const circles = collection(
            "circles",
            [
                relation("owner", users, true, true),
                { name: "name", type: "text", required: true, max: 80 },
                { name: "icon", type: "text", required: true, max: 20 },
                { name: "currency", type: "text", required: true, max: 3 },
                { name: "version", type: "number", required: true, onlyInt: true, min: 1 },
            ],
            ["CREATE INDEX idx_circles_owner ON circles (owner)"],
        );
        const members = collection(
            "circle_members",
            [
                relation("circle", circles, true, true),
                // Preserve the ledger identity if an account is deleted.
                relation("user", users, false, false),
                { name: "name", type: "text", required: true, max: 80 },
                { name: "active", type: "bool" },
            ],
            [
                "CREATE UNIQUE INDEX idx_circle_user ON circle_members (circle, user) WHERE user != ''",
            ],
        );
        collection(
            "circle_invitations",
            [
                relation("circle", circles, true, true),
                { name: "email", type: "email", required: true },
                { name: "expires_at", type: "date", required: true },
                { name: "accepted_at", type: "date" },
                { name: "revoked_at", type: "date" },
            ],
            ["CREATE INDEX idx_circle_invitation_email ON circle_invitations (email, expires_at)"],
        );
        const money = {
            name: "amount_minor",
            type: "number",
            required: true,
            onlyInt: true,
            min: 1,
            max: 99999999999,
        };
        const version = { name: "version", type: "number", required: true, onlyInt: true, min: 1 };
        collection(
            "circle_expenses",
            [
                relation("circle", circles, true, true),
                relation("paid_by", members, true, false),
                relation("created_by", members, true, false),
                { name: "title", type: "text", required: true, max: 160 },
                { name: "currency", type: "text", required: true, max: 3 },
                money,
                version,
                {
                    name: "split_mode",
                    type: "select",
                    values: ["even", "percentage", "exact"],
                    required: true,
                    maxSelect: 1,
                },
                { name: "shares", type: "json", required: true, maxSize: 10000 },
                { name: "payment_method", type: "text", max: 80 },
                { name: "notes", type: "text", max: 2000 },
                { name: "occurred_at", type: "date", required: true },
            ],
            ["CREATE INDEX idx_circle_expense_date ON circle_expenses (circle, occurred_at)"],
        );
        collection(
            "circle_settlements",
            [
                relation("circle", circles, true, true),
                relation("from_member", members, true, false),
                relation("to_member", members, true, false),
                relation("created_by", members, true, false),
                { name: "currency", type: "text", required: true, max: 3 },
                money,
                version,
                { name: "notes", type: "text", max: 1000 },
                { name: "occurred_at", type: "date", required: true },
            ],
            ["CREATE INDEX idx_circle_settlement_date ON circle_settlements (circle, occurred_at)"],
        );
    },
    (app) => {
        [
            "circle_settlements",
            "circle_expenses",
            "circle_invitations",
            "circle_members",
            "circles",
        ].forEach((name) => app.delete(app.findCollectionByNameOrId(name)));
    },
);
