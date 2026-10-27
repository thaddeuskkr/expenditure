import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";

test(
    "Income, recurring expenses and default login tab",
    { timeout: 60000 },
    async (t) => {
        const binary = process.env.POCKETBASE_BINARY;
        assert.ok(binary, "Set POCKETBASE_BINARY to a PocketBase 0.40.6 executable.");
        const directory = await mkdtemp(join(tmpdir(), "expenditure-circles-"));
        const listener = createServer();
        await new Promise((done) => listener.listen(0, "127.0.0.1", done));
        const port = listener.address().port;
        await new Promise((done) => listener.close(done));
        const hooks = join(directory, "hooks");
        await cp(resolve("pocketbase/pb_hooks"), hooks, { recursive: true });
        await writeFile(join(hooks, "test.pb.js"), `routerAdd("POST", "/api/test/recurrence", (e) => {
            require(__hooks + "/recurrence.js").run(e.app, e.requestInfo().body.now);
            return e.json(200, {});
        }, $apis.requireAuth("_superusers"));
        routerAdd("POST", "/api/test/next", (e) => {
            const data = e.requestInfo().body;
            const lib = require(__hooks + "/recurrence.js");
            return e.json(200, { next: data.now ? lib.firstFuture(data.previous, data.frequency, data.anchor, data.timezone, data.now) : lib.nextDate(data.previous, data.frequency, data.anchor, data.timezone) });
        }, $apis.requireAuth("_superusers"));`);
        const flags = [
            `--dir=${directory}`,
            `--hooksDir=${hooks}`,
            `--migrationsDir=${resolve("pocketbase/pb_migrations")}`,
        ];
        const password = randomBytes(24).toString("hex");
        const setup = spawnSync(
            binary,
            ["superuser", "upsert", "admin@example.com", password, ...flags],
            { encoding: "utf8" },
        );
        assert.equal(setup.status, 0, setup.stdout + setup.stderr);
        const server = spawn(
            binary,
            [
                "serve",
                "--automigrate=false",
                "--hooksWatch=false",
                `--http=127.0.0.1:${port}`,
                ...flags,
            ],
            { stdio: ["ignore", "pipe", "pipe"] },
        );
        let logs = "";
        server.stdout.on("data", (c) => {
            logs += c;
        });
        server.stderr.on("data", (c) => {
            logs += c;
        });
        t.after(async () => {
            if (server.exitCode === null && server.signalCode === null) {
                const exited = new Promise((done) => server.once("exit", done));
                server.kill("SIGTERM");
                await exited;
            }

            await rm(directory, { recursive: true, force: true });
        });
        const base = `http://127.0.0.1:${port}`;
        async function api(
            path,
            token,
            body,
            method = body === undefined ? "GET" : "POST",
            expected = 200,
        ) {
            const response = await fetch(base + path, {
                method,
                headers: {
                    ...(token ? { Authorization: token } : {}),
                    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
                },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
            const content = await response.text();
            const data = content ? JSON.parse(content) : null;
            assert.equal(
                response.status,
                expected,
                JSON.stringify({ path, data }) + (response.status >= 500 ? logs : ""),
            );
            return data;
        }

        for (let i = 0; i < 100; i++) {
            try {
                if ((await fetch(base + "/api/health")).ok) break;
            } catch {}

            if (i === 99) assert.fail(logs);
            await new Promise((done) => setTimeout(done, 25));
        }

        const admin = (
            await api("/api/collections/_superusers/auth-with-password", null, {
                identity: "admin@example.com",
                password,
            })
        ).token;
        async function user(name, verified = true) {
            const record = await api("/api/collections/users/records", admin, {
                email: `${name}@example.com`,
                name,
                verified,
                password,
                passwordConfirm: password,
            });
            const auth = await api("/api/collections/users/auth-with-password", null, {
                identity: `${name}@example.com`,
                password,
            });
            return { ...record, token: auth.token };
        }

        const alice = await user("Alice"), bob = await user("Bob"), outside = await user("Outside");
        const personal = "/api/collections/expenses/records";
        const aliceConfig = await api("/api/expenditure/config", alice.token);
        const input = { user: alice.id, merchant: "Salary", amount: 12345, currency: "SGD", category: "Other", occurred_at: "2026-10-27T04:00:00Z", kind: "income", recurrence: "" };
        await t.test("income is isolated, remains positive and does not consume a spending budget", async () => {
            const income = await api(personal, alice.token, input);
            assert.equal(income.kind, "income");
            await api(`${personal}/${income.id}`, outside.token, undefined, "GET", 404);
            await api(personal, alice.token, { ...input, amount: -100 }, "POST", 400);
            await api(personal, alice.token, { ...input, recurrence: "monthly" }, "POST", 400);
            await api(personal, alice.token, { ...input, kind: "invalid" }, "POST", 400);
            const query = new URLSearchParams({ from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z", previous: "2026-09-01T00:00:00Z", currency: "all" });
            const overview = await api(`/api/expenditure/overview?${query}`, alice.token);
            assert.equal(overview.income, 12345);
            assert.equal(overview.total, 0);
            assert.equal(overview.count, 0);
            assert.deepEqual(overview.categories, []);
        });
        await t.test("default login tab is persisted and constrained to known tabs", async () => {
            assert.equal(aliceConfig.preferences.default_tab, "Overview");
            const path = `/api/collections/preferences/records/${aliceConfig.preferences.id}`;
            await api(path, alice.token, { default_tab: "Circles" }, "PATCH");
            assert.equal((await api("/api/expenditure/config", alice.token)).preferences.default_tab, "Circles");
            await api(path, alice.token, { default_tab: "unknown" }, "PATCH", 400);
            await api(path, outside.token, { default_tab: "Overview" }, "PATCH", 404);
        });
        const root = "/api/expenditure/circles";
        await t.test("time format is persisted per user, defaults to 24h and rejects unsupported values", async () => {
            const before = await api("/api/expenditure/config", alice.token);
            assert.equal(before.preferences.time_format, "24h");
            const path = `/api/collections/preferences/records/${before.preferences.id}`;
            await api(path, alice.token, { time_format: "12h" }, "PATCH");
            let after = await api("/api/expenditure/config", alice.token);
            assert.equal(after.preferences.time_format, "12h");
            assert.equal(after.preferences.timezone, before.preferences.timezone);
            assert.equal(after.preferences.default_tab, before.preferences.default_tab);
            assert.equal((await api("/api/expenditure/config", bob.token)).preferences.time_format, "24h");
            await api(path, outside.token, { time_format: "24h" }, "PATCH", 404);
            for (const time_format of ["", "13h", "12", 12, null]) {
                const response = await fetch(base + path, {
                    method: "PATCH", headers: { Authorization: alice.token, "Content-Type": "application/json" },
                    body: JSON.stringify({ time_format }),
                });
                assert.equal(response.status, 400, `time_format=${JSON.stringify(time_format)}`);
            }

            after = await api("/api/expenditure/config", alice.token);
            assert.equal(after.preferences.time_format, "12h");
            await api(path, alice.token, { time_format: "24h" }, "PATCH");
            assert.equal((await api("/api/expenditure/config", alice.token)).preferences.time_format, "24h");
        });
        const circle = await api(root, alice.token, { name: "Shared income", icon: "users", currency: "SGD" }, "POST", 201);
        const me = (await api(`${root}/${circle.id}`, alice.token)).me;
        const invitation = await api(`${root}/${circle.id}/invitations`, alice.token, { email: bob.email }, "POST", 201);
        const other = (await api(`/api/expenditure/circle-invitations/${invitation.id}/accept`, bob.token, {})).member;
        const shared = { title: "Refund", kind: "income", recurrence: "", amount: 101, currency: "SGD", paid_by: me, split_mode: "even", shares: [{ member: me }, { member: other }], occurred_at: input.occurred_at };
        await t.test("Circle income reverses debts for equal, percentage and exact splits", async () => {
            for (const [split_mode, shares] of [
                ["even", shared.shares],
                ["percentage", [{ member: me, percentage_bp: 3000 }, { member: other, percentage_bp: 7000 }]],
                ["exact", [{ member: me, amount: 21 }, { member: other, amount: 80 }]],
            ]) {
                const income = await api(`${root}/${circle.id}/expenses`, alice.token, { ...shared, split_mode, shares }, "POST", 201);
                const detail = await api(`${root}/${circle.id}`, alice.token);
                const entitled = income.shares.find((share) => share.member === other).amount;
                assert.equal(detail.balances.find((row) => row.member === me).net, -entitled);
                assert.equal(detail.balances.find((row) => row.member === other).net, entitled);
                assert.equal(detail.totals[0].total, 0);
                assert.equal(detail.totals[0].income, 101);
                assert.equal(detail.suggestions[0].from_member, me);
                await api(`${root}/${circle.id}/settlements`, alice.token, { from_member: me, to_member: other, amount: entitled + 1, currency: "SGD" }, "POST", 400);
                await api(`${root}/${circle.id}/expenses/${income.id}`, bob.token, { ...shared, split_mode, shares, version: income.version }, "PATCH", 403);
                await api(`${root}/${circle.id}/expenses/${income.id}`, alice.token, { version: income.version }, "DELETE");
            }

            await api(`${root}/${circle.id}/expenses`, outside.token, shared, "POST", 404);
            await api(`${root}/${circle.id}/expenses`, alice.token, { ...shared, recurrence: "weekly" }, "POST", 400);
        });
        await t.test("calendar recurrence clamps month ends and keeps local times across DST", async () => {
            async function next(previous, frequency, anchor, timezone) {
                return (await api("/api/test/next", admin, { previous, frequency, anchor, timezone })).next;
            }

            assert.equal(await next("2027-01-31T01:00:00Z", "monthly", "2027-01-31T09:00:00", "Asia/Singapore"), "2027-02-28T01:00:00.000Z");
            assert.equal(await next("2027-02-28T01:00:00Z", "monthly", "2027-01-31T09:00:00", "Asia/Singapore"), "2027-03-31T01:00:00.000Z");
            assert.equal(await next("2028-02-29T01:00:00Z", "yearly", "2028-02-29T09:00:00", "Asia/Singapore"), "2029-02-28T01:00:00.000Z");
            assert.equal(await next("2027-03-13T14:00:00Z", "daily", "2027-03-13T09:00:00", "America/New_York"), "2027-03-14T13:00:00.000Z");
            assert.equal(await next("2027-11-06T13:00:00Z", "weekly", "2027-11-06T09:00:00", "America/New_York"), "2027-11-13T14:00:00.000Z");
            assert.equal(await next("2027-03-13T07:30:00Z", "daily", "2027-03-13T02:30:00", "America/New_York"), "2027-03-14T07:30:00.000Z");
            for (const [frequency, expected] of [["daily", "2026-10-28T01:00:00.000Z"], ["weekly", "2026-11-02T01:00:00.000Z"], ["monthly", "2026-10-31T01:00:00.000Z"], ["yearly", "2027-01-31T01:00:00.000Z"]]) {
                const result = await api("/api/test/next", admin, { previous: "2000-01-31T01:00:00Z", frequency, anchor: "2000-01-31T09:00:00", timezone: "Asia/Singapore", now: Date.parse("2026-10-27T04:00:00Z") });
                assert.equal(result.next, expected);
            }
        });
        let recurring, recurringCircle;
        const now = Date.parse("2090-01-04T04:00:00Z");
        await t.test("recurring creation catches up once, survives concurrent runs and preserves provenance", async () => {
            recurring = await api(personal, alice.token, { ...input, kind: "expense", recurrence: "daily", merchant: "Recurring", occurred_at: "2090-01-01T04:00:00Z", recurrence_next: "2000-01-01T00:00:00Z", recurrence_timezone: "UTC" });
            assert.equal(recurring.recurrence_next, "2090-01-02T04:00:00.000Z");
            assert.equal(recurring.recurrence_timezone, "Asia/Singapore");
            recurringCircle = await api(`${root}/${circle.id}/expenses`, alice.token, { ...shared, kind: "expense", recurrence: "daily", occurred_at: "2090-01-01T04:00:00Z" }, "POST", 201);
            await Promise.all([api("/api/test/recurrence", admin, { now }), api("/api/test/recurrence", admin, { now })]);
            const rows = (await api(`${personal}?perPage=100`, alice.token)).items.filter((row) => row.merchant === "Recurring");
            assert.equal(rows.length, 4);
            assert.equal(new Set(rows.map((row) => row.occurred_at)).size, 4);
            assert.ok(rows.every((row) => row.amount === 12345 && row.source === "manual"));
            assert.equal(rows.filter((row) => row.recurrence).length, 1);
            const detail = await api(`${root}/${circle.id}`, alice.token);
            assert.equal(detail.expenses.totalItems, 4);
            assert.equal(detail.recurring.length, 1);
            assert.equal(detail.balances.reduce((sum, row) => sum + row.net, 0), 0);
            assert.equal(detail.balances.find((row) => row.member === me).net, recurringCircle.shares.find((share) => share.member === other).amount * 4);
            await api(`${root}/${circle.id}/expenses/${recurringCircle.id}`, alice.token, { ...shared, kind: "expense", recurrence: "daily", version: recurringCircle.version, occurred_at: recurringCircle.occurred_at }, "PATCH", 409);
        });
        await t.test("stopping recurrence preserves generated entries and rejects cross-account edits", async () => {
            await api(`${personal}/${recurring.id}`, outside.token, { recurrence: "" }, "PATCH", 404);
            await api(`${personal}/${recurring.id}`, alice.token, { recurrence: "" }, "PATCH");
            const detail = await api(`${root}/${circle.id}`, alice.token);
            const current = detail.recurring[0];
            await api(`${root}/${circle.id}/expenses/${current.id}`, alice.token, { ...shared, kind: "expense", recurrence: "", occurred_at: new Date(current.occurred_at.replace(" ", "T")).toISOString(), version: current.version }, "PATCH");
            await api("/api/test/recurrence", admin, { now: now + 86400000 });
            assert.equal((await api(`${root}/${circle.id}`, alice.token)).expenses.totalItems, 4);
            assert.equal((await api(`${personal}?perPage=100`, alice.token)).items.filter((row) => row.merchant === "Recurring").length, 4);
        });
        await t.test("recurring Circle writes pause when a participant is no longer active", async () => {
            const seed = await api(`${root}/${circle.id}/expenses`, alice.token, { ...shared, kind: "expense", recurrence: "daily", occurred_at: "2090-01-01T04:00:00Z" }, "POST", 201);
            await api(`/api/collections/circle_members/records/${other}`, admin, { active: false }, "PATCH");
            await api("/api/test/recurrence", admin, { now });
            const detail = await api(`${root}/${circle.id}`, alice.token);
            assert.equal(detail.expenses.totalItems, 5);
            assert.ok(detail.recurring.find((row) => row.id === seed.id).recurrence_error);
            await api("/api/test/recurrence", admin, { now });
            assert.equal((await api(`${root}/${circle.id}`, alice.token)).expenses.totalItems, 5);
        });
    },
);
