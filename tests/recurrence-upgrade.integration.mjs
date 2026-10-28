import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, copyFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";

test("schedule upgrade preserves active and paused cursors, records, identities and Circle balances", { timeout: 30000 }, async (t) => {
    const binary = process.env.POCKETBASE_BINARY;
    assert.ok(binary, "Set POCKETBASE_BINARY to a PocketBase 0.40.6 executable.");
    const directory = await mkdtemp(join(tmpdir(), "expenditure-schedule-upgrade-"));
    const oldMigrations = join(directory, "old-migrations"), oldHooks = join(directory, "old-hooks"), data = join(directory, "data");
    await mkdir(oldMigrations);
    await mkdir(oldHooks);
    for (const file of await readdir(resolve("pocketbase/pb_migrations"))) {
        if (file.endsWith(".js") && file < "1793206800_recurring_income_schedules.js")
            await copyFile(resolve("pocketbase/pb_migrations", file), join(oldMigrations, file));
    }

    for (const file of ["currencies.json", "timezones.json"])
        await copyFile(resolve("pocketbase/pb_hooks", file), join(oldHooks, file));
    const listener = createServer();
    await new Promise((done) => listener.listen(0, "127.0.0.1", done));
    const port = listener.address().port;
    await new Promise((done) => listener.close(done));
    const base = `http://127.0.0.1:${port}`;
    const oldFlags = [`--dir=${data}`, `--migrationsDir=${oldMigrations}`, `--hooksDir=${oldHooks}`];
    const newFlags = [`--dir=${data}`, `--migrationsDir=${resolve("pocketbase/pb_migrations")}`, `--hooksDir=${resolve("pocketbase/pb_hooks")}`];
    const password = randomBytes(24).toString("hex");
    const setup = spawnSync(binary, ["superuser", "upsert", "admin@example.com", password, ...oldFlags], { encoding: "utf8" });
    assert.equal(setup.status, 0, setup.stdout + setup.stderr);
    let server, logs = "";
    async function stop() {
        if (server && server.exitCode === null && server.signalCode === null) {
            const exited = new Promise((done) => server.once("exit", done));
            server.kill("SIGTERM");
            await exited;
        }
    }

    t.after(async () => {
        await stop();
        await rm(directory, { recursive: true, force: true });
    });
    async function start(flags) {
        server = spawn(binary, ["serve", "--automigrate=false", "--hooksWatch=false", `--http=127.0.0.1:${port}`, ...flags], { stdio: ["ignore", "pipe", "pipe"] });
        server.stdout.on("data", (chunk) => {
            logs += chunk;
        });
        server.stderr.on("data", (chunk) => {
            logs += chunk;
        });
        for (let index = 0; index < 100; index++) {
            try {
                if ((await fetch(base + "/api/health")).ok) return;
            } catch {}

            if (server.exitCode !== null) assert.fail(logs);
            await new Promise((done) => setTimeout(done, 30));
        }

        assert.fail(logs);
    }

    async function api(path, token, body, method = body === undefined ? "GET" : "POST") {
        const response = await fetch(base + path, {
            method,
            headers: { ...(token ? { Authorization: token } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const content = await response.text();
        const result = content ? JSON.parse(content) : null;
        assert.ok(response.ok, JSON.stringify({ path, result }) + logs);
        return result;
    }

    await start(oldFlags);
    const admin = (await api("/api/collections/_superusers/auth-with-password", null, { identity: "admin@example.com", password })).token;
    await api("/api/collections/users", admin, { oauth2: { enabled: true, providers: [{ name: "oidc", displayName: "Existing provider", clientId: "upgrade-test", clientSecret: "disposable-test-secret", authURL: "https://identity.example.com/authorize", tokenURL: "https://identity.example.com/token", userInfoURL: "https://identity.example.com/userinfo" }] } }, "PATCH");
    const identity = await api("/api/collections/users", admin);
    const user = await api("/api/collections/users/records", admin, { email: "schedule@example.com", name: "Schedule owner", password, passwordConfirm: password, verified: true });
    const prefs = await api("/api/collections/preferences/records", admin, { user: user.id, currency: "SGD", currencies: ["SGD"], timezone: "America/New_York", default_tab: "Transactions", time_format: "12h", show_circle_transactions: true });
    await api("/api/collections/categories/records", admin, { user: user.id, name: "Other", active: true, color: "#123456", sort_order: 0 });
    const fields = { user: user.id, merchant: "Existing schedule", kind: "expense", amount: 650, currency: "SGD", category: "Other", payment_method: "Saved card", source: "manual", notes: "Keep this", occurred_at: "2091-01-31T14:00:00Z", recurrence: "monthly", recurrence_anchor: "2091-01-31T09:00:00", recurrence_timezone: "America/New_York", recurrence_next: "2091-02-28T14:00:00.000Z" };
    const active = await api("/api/collections/expenses/records", admin, fields);
    const paused = await api("/api/collections/expenses/records", admin, { ...fields, merchant: "Paused schedule", recurrence_error: "Resolve this first" });
    const income = await api("/api/collections/expenses/records", admin, { ...fields, kind: "income", merchant: "Existing income", recurrence: "", recurrence_anchor: "", recurrence_timezone: "", recurrence_next: "" });
    const circle = await api("/api/collections/circles/records", admin, { owner: user.id, name: "Existing circle", icon: "users", currency: "SGD", version: 2 });
    const payer = await api("/api/collections/circle_members/records", admin, { circle: circle.id, user: user.id, name: user.name, active: true });
    const former = await api("/api/collections/circle_members/records", admin, { circle: circle.id, name: "Former member", active: false });
    await api("/api/collections/circle_categories/records", admin, { circle: circle.id, name: "Other", color: "#654321", active: true, sort_order: 0 });
    const shared = await api("/api/collections/circle_expenses/records", admin, { ...fields, user: undefined, title: "Existing Circle schedule", circle: circle.id, paid_by: payer.id, created_by: payer.id, version: 4, split_mode: "exact", shares: [{ member: payer.id, amount: 250 }, { member: former.id, amount: 400 }] });
    await stop();
    const upgrade = spawnSync(binary, ["migrate", "up", ...newFlags], { encoding: "utf8" });
    assert.equal(upgrade.status, 0, upgrade.stdout + upgrade.stderr);
    await start(newFlags);
    assert.equal((await api("/api/expenditure/status")).version, 16);
    assert.deepEqual((await api("/api/collections/users", admin)).oauth2, identity.oauth2);
    for (const [collection, records] of [["expenses", [active, paused, income]], ["circle_expenses", [shared]]]) {
        for (const original of records) {
            const upgraded = await api(`/api/collections/${collection}/records/${original.id}`, admin);
            for (const key of Object.keys(original)) assert.deepEqual(upgraded[key], original[key], `${collection}.${key}`);
            assert.equal(upgraded.recurrence_interval, original.recurrence ? 1 : 0);
            assert.equal(upgraded.recurrence_day, 0);
        }
    }

    const auth = await api("/api/collections/users/auth-with-password", null, { identity: user.email, password });
    const detail = await api(`/api/expenditure/circles/${circle.id}`, auth.token);
    assert.equal(detail.balances.find((row) => row.member === payer.id).net, 400);
    assert.equal(detail.balances.find((row) => row.member === former.id).net, -400);
    assert.equal(detail.recurring[0].recurrence_next, shared.recurrence_next);
    await api(`/api/collections/preferences/records/${prefs.id}`, auth.token, { timezone: "Asia/Singapore" }, "PATCH");
    const edited = await api(`/api/collections/expenses/records/${active.id}`, auth.token, { notes: "Changed note" }, "PATCH");
    assert.equal(edited.recurrence_next, active.recurrence_next);
    assert.equal(edited.recurrence_timezone, "America/New_York");
    assert.equal(edited.recurrence_anchor, active.recurrence_anchor);
    await stop();
    const repeat = spawnSync(binary, ["migrate", "up", ...newFlags], { encoding: "utf8" });
    assert.equal(repeat.status, 0, repeat.stdout + repeat.stderr);
    await start(newFlags);
    assert.equal((await api(`/api/collections/expenses/records/${paused.id}`, auth.token)).recurrence_error, paused.recurrence_error);
});
