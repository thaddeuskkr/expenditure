import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";

test("Personal transaction defaults persist, validate ownership and preserve ledger behavior", { timeout: 60000 }, async (t) => {
    const binary = process.env.POCKETBASE_BINARY;
    assert.ok(binary, "Set POCKETBASE_BINARY to a PocketBase 0.40.6 executable.");
    const directory = await mkdtemp(join(tmpdir(), "expenditure-defaults-"));
    const listener = createServer();
    await new Promise((done) => listener.listen(0, "127.0.0.1", done));
    const port = listener.address().port;
    await new Promise((done) => listener.close(done));
    const flags = [`--dir=${directory}`, `--hooksDir=${resolve("pocketbase/pb_hooks")}`, `--migrationsDir=${resolve("pocketbase/pb_migrations")}`];
    const password = randomBytes(24).toString("hex");
    const setup = spawnSync(binary, ["superuser", "upsert", "admin@example.com", password, ...flags], { encoding: "utf8" });
    assert.equal(setup.status, 0, setup.stdout + setup.stderr);
    const server = spawn(binary, ["serve", "--automigrate=false", "--hooksWatch=false", `--http=127.0.0.1:${port}`, ...flags], { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    server.stdout.on("data", (chunk) => {
        logs += chunk;
    });
    server.stderr.on("data", (chunk) => {
        logs += chunk;
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
    async function api(path, { token, key, body, headers = {}, method = body === undefined ? "GET" : "POST", expected = 200 } = {}) {
        const response = await fetch(base + path, {
            method,
            headers: { ...headers, ...(token ? { Authorization: token } : {}), ...(key ? { "X-API-Key": key } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const content = await response.text();
        const data = content ? JSON.parse(content) : null;
        assert.equal(response.status, expected, JSON.stringify({ path, data }) + (response.status >= 500 ? logs : ""));
        return data;
    }

    for (let index = 0; index < 100; index++) {
        try {
            if ((await fetch(base + "/api/health")).ok) break;
        } catch {}

        if (index === 99) assert.fail(logs);
        await new Promise((done) => setTimeout(done, 25));
    }

    const admin = (await api("/api/collections/_superusers/auth-with-password", { body: { identity: "admin@example.com", password } })).token;
    async function user(name) {
        const record = await api("/api/collections/users/records", { token: admin, body: { email: `${name}@example.com`, name, password, passwordConfirm: password, verified: true } });
        const auth = await api("/api/collections/users/auth-with-password", { body: { identity: record.email, password } });
        await api("/api/expenditure/config", { token: auth.token });
        return { ...record, token: auth.token };
    }

    const owner = await user("Defaults"), outsider = await user("Outsider");
    const config = () => api("/api/expenditure/config", { token: owner.token });
    const initial = await config();
    const path = `/api/collections/preferences/records/${initial.preferences.id}`;
    const save = (body, expected = 200) => api(path, { token: owner.token, method: "PATCH", body, expected });
    const categories = initial.categories;
    const expenseCategory = categories.find((category) => category.name === "Food & drinks");
    const incomeCategory = categories.find((category) => category.name === "Other");
    const outsiderCategory = (await api("/api/expenditure/config", { token: outsider.token })).categories[0];
    const entry = await api("/api/collections/expenses/records", { token: owner.token, body: {
        user: owner.id, merchant: "Existing entry", amount: 650, currency: "SGD", category: "Other", occurred_at: "2026-10-29T04:05:06Z", payment_method: "Cash", notes: "Preserved",
    } });
    await t.test("fresh accounts have empty defaults and native creation preserves them", async () => {
        for (const field of ["default_entry_currency", "default_expense_category", "default_income_category"])
            assert.equal(initial.preferences[field], "");
        const fresh = await api("/api/collections/users/records", { token: admin, body: { email: "native@example.com", password, passwordConfirm: password } });
        const created = await api("/api/collections/preferences/records", { token: admin, body: { user: fresh.id, currency: "SGD", currencies: ["SGD"], timezone: "Asia/Singapore" } });
        assert.equal(created.default_entry_currency, "");
        assert.equal(created.default_expense_category, "");
        assert.equal(created.default_income_category, "");
    });
    await t.test("separate category IDs and an enabled entry currency survive reload", async () => {
        await save({ default_entry_currency: "USD", default_expense_category: expenseCategory.id, default_income_category: incomeCategory.id });
        const preferences = (await config()).preferences;
        assert.equal(preferences.default_entry_currency, "USD");
        assert.equal(preferences.currency, "SGD");
        assert.equal(preferences.default_expense_category, expenseCategory.id);
        assert.equal(preferences.default_income_category, incomeCategory.id);
        assert.deepEqual(await api(`/api/collections/expenses/records/${entry.id}`, { token: owner.token }), entry);
    });
    await t.test("invalid currencies and foreign, missing or archived categories are rejected", async () => {
        await save({ default_entry_currency: "XYZ" }, 400);
        await save({ default_entry_currency: "JPY" }, 400);
        for (const field of ["default_expense_category", "default_income_category"]) {
            await save({ [field]: outsiderCategory.id }, 400);
            await save({ [field]: "missing00000000" }, 400);
        }

        const archived = categories.find((category) => category.name === "Groceries");
        await api(`/api/expenditure/categories/${archived.id}`, { token: owner.token, method: "PATCH", body: { active: false } });
        await save({ default_expense_category: archived.id }, 400);
        await api(path, { token: outsider.token, method: "PATCH", body: { default_entry_currency: "EUR" }, expected: 404 });
        assert.equal((await config()).preferences.default_entry_currency, "USD");
    });
    await t.test("renaming preserves IDs and archiving clears both category defaults atomically", async () => {
        await api(`/api/expenditure/categories/${expenseCategory.id}`, { token: owner.token, method: "PATCH", body: { name: "Meals" } });
        assert.equal((await config()).preferences.default_expense_category, expenseCategory.id);
        await save({ default_income_category: expenseCategory.id });
        await api(`/api/expenditure/categories/${expenseCategory.id}`, { token: owner.token, method: "PATCH", body: { active: false } });
        const preferences = (await config()).preferences;
        assert.equal(preferences.default_expense_category, "");
        assert.equal(preferences.default_income_category, "");
        await api(`/api/expenditure/categories/${expenseCategory.id}`, { token: owner.token, method: "PATCH", body: { active: true } });
        assert.equal((await config()).preferences.default_expense_category, "");
        assert.deepEqual(await api(`/api/collections/expenses/records/${entry.id}`, { token: owner.token }), entry);
    });
    await t.test("disabling the preferred currency resets it without rewriting history", async () => {
        const preferences = await save({ currencies: ["SGD", "EUR"] });
        assert.equal(preferences.default_entry_currency, "");
        await save({ default_entry_currency: "EUR" });
        assert.equal((await save({ currency: "EUR" })).default_entry_currency, "EUR");
        await save({ default_entry_currency: "" });
        assert.equal((await config()).preferences.default_entry_currency, "");
        assert.deepEqual(await api(`/api/collections/expenses/records/${entry.id}`, { token: owner.token }), entry);
        await save({ currency: "SGD", currencies: ["SGD", "USD", "EUR"] });
    });
    await t.test("concurrent archiving and default selection cannot retain an archived category", async () => {
        for (let index = 0; index < 8; index++) {
            await api(`/api/expenditure/categories/${expenseCategory.id}`, { token: owner.token, method: "PATCH", body: { active: true } });
            const [selection] = await Promise.all([
                fetch(base + path, { method: "PATCH", headers: { Authorization: owner.token, "Content-Type": "application/json" }, body: JSON.stringify({ default_expense_category: expenseCategory.id }) }),
                api(`/api/expenditure/categories/${expenseCategory.id}`, { token: owner.token, method: "PATCH", body: { active: false } }),
            ]);
            assert.ok([200, 400].includes(selection.status), await selection.text());
            assert.equal((await config()).preferences.default_expense_category, "");
        }

        await api(`/api/expenditure/categories/${expenseCategory.id}`, { token: owner.token, method: "PATCH", body: { active: true } });
    });
    await t.test("API imports retain their own defaults despite personal form preferences", async () => {
        await save({ default_entry_currency: "USD", default_expense_category: expenseCategory.id, default_income_category: incomeCategory.id });
        const key = await api("/api/expenditure/keys", { token: owner.token, body: { name: "Default isolation", scopes: ["expenses:write"], expires_at: "" }, expected: 201 });
        const imported = await api("/api/expenses/transactions", { key: key.key, body: { merchant: "API defaults", amount: 650 }, expected: 201 });
        assert.equal(imported.currency, "SGD");
        assert.equal(imported.category, "Other");
        const circle = await api("/api/expenditure/circles", { token: owner.token, body: { name: "Independent defaults", currency: "EUR" }, expected: 201 });
        const shared = await api(`/api/expenses/circles/${circle.id}/transactions`, { key: key.key, body: { title: "Circle defaults", amount: 650 }, expected: 201 });
        assert.equal(shared.currency, "EUR");
        assert.equal(shared.category, "Other");
    });
});
