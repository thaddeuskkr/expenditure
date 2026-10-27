import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";

test(
    "upgrade preserves existing amounts, categories, budgets, preferences and API keys",
    { timeout: 30000 },
    async (t) => {
        const binary = process.env.POCKETBASE_BINARY;
        assert.ok(binary, "Set POCKETBASE_BINARY to a PocketBase executable.");
        const directory = await mkdtemp(join(tmpdir(), "expenditure-upgrade-"));
        const oldMigrations = join(directory, "old-migrations"),
            oldHooks = join(directory, "old-hooks"),
            data = join(directory, "data");
        await mkdir(oldMigrations);
        await mkdir(oldHooks);
        await copyFile(
            resolve("pocketbase/pb_migrations/1793026800_expenditure.js"),
            join(oldMigrations, "1793026800_expenditure.js"),
        );
        const listener = createServer();
        await new Promise((done) => listener.listen(0, "127.0.0.1", done));
        const port = listener.address().port;
        await new Promise((done) => listener.close(done));
        const base = `http://127.0.0.1:${port}`;
        const oldFlags = [
            `--dir=${data}`,
            `--migrationsDir=${oldMigrations}`,
            `--hooksDir=${oldHooks}`,
        ];
        const newFlags = [
            `--dir=${data}`,
            `--migrationsDir=${resolve("pocketbase/pb_migrations")}`,
            `--hooksDir=${resolve("pocketbase/pb_hooks")}`,
        ];
        const password = randomBytes(24).toString("hex");
        const setup = spawnSync(
            binary,
            ["superuser", "upsert", "test@example.com", password, ...oldFlags],
            { encoding: "utf8" },
        );
        assert.equal(setup.status, 0, setup.stderr);
        let child;
        async function stop() {
            if (child && child.exitCode === null && child.signalCode === null) {
                const exited = new Promise((done) => child.once("exit", done));
                child.kill("SIGTERM");
                await exited;
            }
        }

        t.after(async () => {
            await stop();
            await rm(directory, { recursive: true, force: true });
        });
        async function start(flags) {
            child = spawn(binary, ["serve", "--automigrate=false", "--hooksWatch=false", `--http=127.0.0.1:${port}`, ...flags], {
                stdio: ["ignore", "pipe", "pipe"],
            });
            let logs = "";
            child.stdout.on("data", (c) => {
                logs += c;
            });
            child.stderr.on("data", (c) => {
                logs += c;
            });
            for (let i = 0; i < 100; i++) {
                try {
                    if ((await fetch(base + "/api/health")).ok) return;
                } catch {}

                if (child.exitCode !== null) assert.fail(logs);
                await new Promise((done) => setTimeout(done, 30));
            }

            assert.fail(logs);
        }

        await start(oldFlags);
        async function request(path, token, body, method = body ? "POST" : "GET") {
            const response = await fetch(base + path, {
                method,
                headers: {
                    ...(token ? { Authorization: token } : {}),
                    ...(body ? { "Content-Type": "application/json" } : {}),
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await response.text();
            const result = text ? JSON.parse(text) : null;
            assert.ok(response.ok, JSON.stringify(result));
            return result;
        }

        const admin = (
            await request("/api/collections/_superusers/auth-with-password", null, {
                identity: "test@example.com",
                password,
            })
        ).token;
        await request("/api/collections/users", admin, {
            oauth2: {
                enabled: true,
                providers: [{
                    name: "oidc",
                    displayName: "Existing identity provider",
                    clientId: "upgrade-test",
                    clientSecret: "disposable-test-secret",
                    authURL: "https://identity.example.com/authorize",
                    tokenURL: "https://identity.example.com/token",
                    userInfoURL: "https://identity.example.com/userinfo",
                }],
            },
        }, "PATCH");
        const identityBefore = await request("/api/collections/users", admin);
        const user = await request("/api/collections/users/records", admin, {
            email: "upgrade@example.com",
            password,
            passwordConfirm: password,
        });
        const expense = await request("/api/collections/expenses/records", admin, {
            user: user.id,
            merchant: "Existing coffee",
            currency: "SGD",
            category: "Food & drinks",
            amount_cents: 850,
            occurred_at: "2026-10-26T00:00:00Z",
            source: "api",
            idempotency_key: "preserved-idempotency",
        });
        await request("/api/collections/budgets/records", admin, {
            user: user.id,
            month: "2026-10",
            currency: "SGD",
            category: "Overall",
            amount_cents: 100000,
        });
        const budget = await request("/api/collections/budgets/records", admin, {
            user: user.id,
            month: "2026-10",
            currency: "SGD",
            category: "Food & drinks",
            amount_cents: 20000,
        });
        const prefs = await request("/api/collections/preferences/records", admin, {
            user: user.id,
            currency: "SGD",
            timezone: "Asia/Singapore",
        });
        const key = await request("/api/collections/api_keys/records", admin, {
            user: user.id,
            name: "Existing key",
            key_hash: "existing-secret-hash",
            key_prefix: "exp_existing",
            scopes: ["expenses:read"],
        });
        await stop();
        // Stage the previous schema with real category rows before adding order.
        await copyFile(resolve("pocketbase/pb_hooks/currencies.json"), join(oldHooks, "currencies.json"));
        for (const file of ["1793100000_categories_currencies_rates.js", "1793103600_circles.js"]) {
            await copyFile(resolve("pocketbase/pb_migrations", file), join(oldMigrations, file));
        }

        const previousSchema = spawnSync(binary, ["migrate", "up", ...oldFlags], { encoding: "utf8" });
        assert.equal(previousSchema.status, 0, previousSchema.stderr + previousSchema.stdout);
        await start(oldFlags);
        const secondUser = await request("/api/collections/users/records", admin, {
            email: "second-upgrade@example.com", password, passwordConfirm: password,
        });
        for (const [owner, names] of [[user.id, ["Other", "Food & drinks", "Groceries"]], [secondUser.id, ["Second Z", "Second A"]]]) {
            for (const [index, name] of names.entries()) {
                await request("/api/collections/categories/records", admin, {
                    user: owner, name, color: "#aabbcc", active: index !== 0,
                });
            }
        }

        async function categoryRows(owner, sort) {
            return (await request(`/api/collections/categories/records?perPage=100&sort=${sort}&filter=${encodeURIComponent(`user = '${owner}'`)}`, admin)).items;
        }

        const previousCategories = await categoryRows(user.id, "created,name,id");
        const secondPrevious = await categoryRows(secondUser.id, "created,name,id");
        await stop();
        const upgrade = spawnSync(binary, ["migrate", "up", ...newFlags], {
            encoding: "utf8",
        });
        assert.equal(upgrade.status, 0, upgrade.stderr + upgrade.stdout);
        await start(newFlags);
        const identityAfter = await request("/api/collections/users", admin);
        assert.deepEqual(identityAfter.oauth2, identityBefore.oauth2);
        assert.deepEqual(identityAfter.passwordAuth, identityBefore.passwordAuth);
        const after = await request(
            `/api/collections/expenses/records/${expense.id}`,
            admin,
        );
        assert.equal(after.amount_cents, 850);
        assert.equal(after.category, "Food & drinks");
        assert.equal(after.currency, "SGD");
        assert.equal(after.source, "api");
        const preserved = await request(
            `/api/collections/budgets/records/${budget.id}`,
            admin,
        );
        assert.equal(preserved.category, "Food & drinks");
        assert.equal(preserved.amount_cents, 20000);
        assert.equal(
            (await request("/api/collections/budgets/records", admin)).totalItems,
            2,
        );
        assert.equal(
            (await request(`/api/collections/preferences/records/${prefs.id}`, admin))
                .timezone,
            "Asia/Singapore",
        );
        assert.equal(
            (await request(`/api/collections/api_keys/records/${key.id}`, admin))
                .key_prefix,
            "exp_existing",
        );
        const stored = await request(
            `/api/collections/expenses/records?filter=${encodeURIComponent("idempotency_key = 'preserved-idempotency'")}`,
            admin,
        );
        assert.equal(stored.totalItems, 1);
        const auth = await request(
            "/api/collections/users/auth-with-password",
            null,
            { identity: "upgrade@example.com", password },
        );
        const config = await request("/api/expenditure/config", auth.token);
        assert.deepEqual(config.categories.map((category) => category.id), previousCategories.map((category) => category.id));
        assert.deepEqual(config.categories.map((category) => category.sort_order), [0, 1, 2]);
        assert.deepEqual(config.categories.map((category) => category.active), previousCategories.map((category) => category.active));
        const secondAfter = await categoryRows(secondUser.id, "sort_order");
        assert.deepEqual(secondAfter.map((category) => category.id), secondPrevious.map((category) => category.id));
        assert.deepEqual(secondAfter.map((category) => category.sort_order), [0, 1]);
        assert.ok(config.categories.some((c) => c.name === "Food & drinks"));
        assert.equal(config.preferences.currency, "SGD");
        // Re-running migration commands must not duplicate or reset user data.
        await stop();
        const repeat = spawnSync(binary, ["migrate", "up", ...newFlags], {
            encoding: "utf8",
        });
        assert.equal(repeat.status, 0, repeat.stderr);
    },
);
