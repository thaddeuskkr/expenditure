import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";

test("API-key Circle expenses use the key owner's membership and start fully self-allocated", { timeout: 60000 }, async (t) => {
    const binary = process.env.POCKETBASE_BINARY;
    assert.ok(binary, "Set POCKETBASE_BINARY to a PocketBase 0.40.6 executable.");
    const directory = await mkdtemp(join(tmpdir(), "expenditure-circle-api-"));
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
    async function api(path, { token, key, body, method = body === undefined ? "GET" : "POST", expected = 200 } = {}) {
        const response = await fetch(base + path, {
            method,
            headers: { ...(token ? { Authorization: token } : {}), ...(key ? { "X-API-Key": key } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
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

    const owner = await user("Owner"), member = await user("Member"), outsider = await user("Outsider");
    const root = "/api/expenditure/circles";
    const circle = await api(root, { token: owner.token, body: { name: "API ledger", currency: "SGD" }, expected: 201 });
    const otherCircle = await api(root, { token: owner.token, body: { name: "Private ledger", currency: "JPY" }, expected: 201 });
    const invite = await api(`${root}/${circle.id}/invitations`, { token: owner.token, body: { email: member.email }, expected: 201 });
    const memberId = (await api(`/api/expenditure/circle-invitations/${invite.id}/accept`, { token: member.token, body: {} })).member;
    const detail = () => api(`${root}/${circle.id}`, { token: owner.token });
    const ownerId = (await detail()).me;
    async function key(user, scopes = ["expenses:write"]) {
        return api("/api/expenditure/keys", { token: user.token, body: { name: "Circle integration", scopes, expires_at: "" }, expected: 201 });
    }

    const memberKey = await key(member), ownerKey = await key(owner), outsiderKey = await key(outsider), readKey = await key(member, ["expenses:read"]);
    const path = `/api/expenses/circles/${circle.id}/transactions`;
    const input = { title: "Member's coffee", amount: 650 };
    let imported;
    await t.test("only a valid write key belonging to an active member can create", async () => {
        await api(path, { body: input, expected: 401 });
        await api(path, { token: member.token, body: input, expected: 401 });
        await api(path, { key: "exp_invalid", body: input, expected: 401 });
        await api(path, { key: readKey.key, body: input, expected: 403 });
        await api(path, { key: outsiderKey.key, body: input, expected: 404 });
        // An unrelated user session must never override the API key identity.
        await api(path, { token: owner.token, key: outsiderKey.key, body: input, expected: 404 });
        await api(`/api/expenses/circles/${otherCircle.id}/transactions`, { key: memberKey.key, body: input, expected: 404 });
        await api("/api/expenses/circles/not-an-id/transactions", { key: memberKey.key, body: input, expected: 404 });
        assert.equal((await detail()).expenses.totalItems, 0);
    });
    await t.test("defaults are Circle-local and every minor unit belongs to the key owner", async () => {
        const before = Date.now();
        imported = await api(path, { token: owner.token, key: memberKey.key, body: input, expected: 201 });
        assert.equal(imported.circle, circle.id);
        assert.equal(imported.paid_by, memberId);
        assert.equal(imported.created_by, memberId);
        assert.notEqual(imported.paid_by, member.id);
        assert.equal(imported.split_mode, "percentage");
        assert.deepEqual(imported.shares, [{ member: memberId, amount: 650, percentage_bp: 10000 }]);
        assert.equal(imported.currency, "SGD");
        assert.equal(imported.category, "Other");
        assert.equal(imported.source, "api");
        assert.equal(imported.kind, "expense");
        assert.equal(imported.recurrence, "");
        assert.equal(imported.origin_expense, "");
        assert.equal(imported.version, 1);
        assert.ok(Date.parse(imported.occurred_at) >= before - 1000);
        assert.equal((await detail()).balances.every((row) => row.net === 0), true);
        assert.deepEqual((await detail()).suggestions, []);
        assert.equal((await api("/api/expenses/transactions", { key: (await key(member, ["expenses:read"])).key })).totalItems, 0);
        const metadata = (await api("/api/expenditure/keys", { token: member.token })).items.find((item) => item.id === memberKey.record.id);
        assert.ok(metadata.last_used);
        assert.equal(metadata.key_hash, undefined);
    });
    await t.test("API clients cannot choose payer, allocations, provenance or schedules", async () => {
        const total = (await detail()).expenses.totalItems;
        for (const fields of [
            { paid_by: ownerId }, { paid_by: memberId }, { created_by: ownerId }, { user: owner.id },
            { circle: otherCircle.id }, { shares: [{ member: ownerId }] }, { split_mode: "even" },
            { source: "manual" }, { origin_expense: "existingexpense" }, { kind: "income" },
            { recurrence: "daily" }, { version: 2 }, { idempotency_key: "attempt" },
        ]) await api(path, { key: memberKey.key, body: { ...input, ...fields }, expected: 400 });
        assert.equal((await detail()).expenses.totalItems, total);
    });
    await t.test("money, text, timestamps and active Circle categories are validated atomically", async () => {
        const total = (await detail()).expenses.totalItems;
        for (const body of [null, [], {}, { amount: 650 }, { ...input, title: "" }, { ...input, title: "x".repeat(161) },
            ...[0, -1, 1.5, "650", 100000000000, null].map((amount) => ({ ...input, amount })),
            { ...input, currency: "BAD" }, { ...input, currency: "sgd" }, { ...input, category: "Not a category" },
            { ...input, payment_method: "x".repeat(81) }, { ...input, notes: "x".repeat(2001) },
            { ...input, occurred_at: "2026-10-27T12:00:00" }, { ...input, occurred_at: "2026-02-30T12:00:00Z" },
        ]) await api(path, { key: memberKey.key, body, expected: 400 });
        const category = await api(`${root}/${circle.id}/categories`, { token: owner.token, body: { name: "Circle only", color: "#123456" }, expected: 201 });
        const created = await api(path, { key: memberKey.key, body: { ...input, amount: 1234, currency: "KWD", category: category.name, occurred_at: "2026-10-27T12:30:00+08:00", payment_method: "Visa", notes: "Original note" }, expected: 201 });
        assert.equal(created.amount, 1234);
        assert.equal(created.currency, "KWD");
        assert.equal(created.shares[0].amount, 1234);
        assert.equal(Date.parse(created.occurred_at), Date.parse("2026-10-27T04:30:00Z"));
        assert.equal(created.payment_method, "Visa");
        assert.equal(created.notes, "Original note");
        await api(`${root}/${circle.id}/categories/${category.id}`, { token: owner.token, method: "PATCH", body: { active: false } });
        await api(path, { key: memberKey.key, body: { ...input, category: category.name }, expected: 400 });
        assert.equal((await detail()).expenses.totalItems, total + 1);
        const yen = await api(`/api/expenses/circles/${otherCircle.id}/transactions`, { key: ownerKey.key, body: { ...input, amount: 123 }, expected: 201 });
        assert.equal(yen.currency, "JPY");
        assert.equal(yen.amount, 123);
    });
    await t.test("write keys cannot read or manage Circles, or edit allocations", async () => {
        for (const route of [root, `${root}/${circle.id}`]) await api(route, { key: memberKey.key, expected: 401 });
        const native = "/api/collections/circle_expenses/records";
        await api(native, { key: memberKey.key, body: imported, expected: 403 });
        const sessionInput = { ...input, currency: "SGD", paid_by: memberId, split_mode: "even", shares: [{ member: memberId }, { member: ownerId }], version: imported.version };
        await api(`${root}/${circle.id}/expenses`, { key: memberKey.key, body: sessionInput, expected: 401 });
        await api(`${root}/${circle.id}/expenses/${imported.id}`, { key: memberKey.key, method: "PATCH", body: sessionInput, expected: 401 });
        await api(`${root}/${circle.id}`, { key: memberKey.key, method: "DELETE", body: { confirmation: circle.name, version: circle.version }, expected: 401 });
    });
    await t.test("the author can split on the website while retaining API provenance and ownership", async () => {
        const edit = { title: imported.title, amount: imported.amount, currency: imported.currency, category: imported.category, paid_by: imported.paid_by, occurred_at: new Date(imported.occurred_at.replace(" ", "T")).toISOString(), split_mode: "even", shares: [{ member: memberId }, { member: ownerId }], version: imported.version };
        const changed = await api(`${root}/${circle.id}/expenses/${imported.id}`, { token: member.token, method: "PATCH", body: edit });
        assert.equal(changed.source, "api");
        assert.equal(changed.created_by, memberId);
        assert.equal(changed.paid_by, memberId);
        assert.deepEqual(changed.shares.map((share) => share.amount), [325, 325]);
        assert.equal((await detail()).balances.find((row) => row.member === memberId && row.currency === "SGD").net, 325);
        await api(`${root}/${circle.id}/expenses/${imported.id}`, { token: owner.token, method: "PATCH", body: { ...edit, split_mode: "percentage", shares: [{ member: memberId, percentage_bp: 10000 }], version: changed.version } });
        assert.ok((await detail()).balances.every((row) => row.net === 0));
    });
    await t.test("concurrent member and owner requests cannot mix payer identities", async () => {
        const records = await Promise.all([memberKey, ownerKey, memberKey, ownerKey].map((key) => api(path, { key: key.key, body: input, expected: 201 })));
        records.forEach((record, index) => {
            const expected = index % 2 === 0 ? memberId : ownerId;
            assert.equal(record.paid_by, expected);
            assert.deepEqual(record.shares, [{ member: expected, amount: 650, percentage_bp: 10000 }]);
        });
        assert.ok((await detail()).balances.every((row) => row.net === 0));
    });
    await t.test("expired, revoked, removed and deleted identities lose creation access", async () => {
        const revoked = await key(member);
        await api(`/api/expenditure/keys/${revoked.record.id}`, { token: member.token, method: "DELETE" });
        await api(path, { key: revoked.key, body: input, expected: 401 });
        const expired = await key(member);
        await api(`/api/collections/api_keys/records/${expired.record.id}`, { token: admin, method: "PATCH", body: { expires_at: "2020-01-01T00:00:00Z" } });
        await api(path, { key: expired.key, body: input, expected: 401 });
        const total = (await detail()).expenses.totalItems;
        await api(`${root}/${circle.id}/members/${memberId}`, { token: member.token, method: "DELETE" });
        await api(path, { key: memberKey.key, body: input, expected: 404 });
        assert.equal((await detail()).expenses.totalItems, total);
        await api(`/api/collections/users/records/${member.id}`, { token: admin, method: "DELETE", expected: 204 });
        await api(path, { key: memberKey.key, body: input, expected: 401 });
    });
});
