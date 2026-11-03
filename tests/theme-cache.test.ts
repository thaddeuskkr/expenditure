import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { cacheTheme, readCachedTheme, themeBootstrap, THEME_CACHE_KEY } from "../src/lib/theme-cache.ts";
import { presets } from "../src/lib/theme.ts";

const server = "https://backend.example.test";
function storage() {
    const data = new Map<string, string>();
    return {
        getItem: (key: string) => data.get(key) || null,
        setItem: (key: string, value: string) => { data.set(key, value); },
        removeItem: (key: string) => { data.delete(key); },
    };
}

function bootstrap(localStorage: ReturnType<typeof storage>) {
    const variables = new Map<string, string>();
    let dark = true;
    const meta = { content: "default" };
    runInNewContext(themeBootstrap(server), {
        localStorage, atob, Date,
        document: {
            documentElement: {
                style: { setProperty: (key: string, value: string) => { variables.set(key, value); } },
                classList: { toggle: (_: string, value: boolean) => { dark = value; } },
            },
            querySelector: () => meta,
        },
    });
    return { variables, dark, meta };
}

function authenticated() {
    const local = storage();
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600 })).toString("base64url");
    local.setItem("pocketbase_auth", JSON.stringify({ record: { id: "account-a" }, token: `header.${payload}.signature` }));
    return local;
}

test("confirmed account themes restore before hydration and refresh from later saved values", () => {
    const local = authenticated();
    for (const preset of presets) {
        const theme = { preset: preset.id, colors: preset.colors };
        cacheTheme(local, "account-a", server, theme);
        assert.deepEqual(readCachedTheme(local, "account-a", server), theme);
        const result = bootstrap(local);
        assert.equal(result.variables.get("--background"), theme.colors.background);
        assert.equal(result.variables.get("--primary"), theme.colors.accent);
        assert.equal(result.meta.content, theme.colors.background);
    }

    const light = { preset: "custom" as const, colors: { background: "#FFFFFF", surface: "#F5F5F5", raised: "#EEEEEE", accent: "#174EA6", text: "#111111", muted: "#444444" } };
    cacheTheme(local, "account-a", server, light);
    assert.equal(bootstrap(local).dark, false);
    assert.equal(bootstrap(local).variables.get("--background"), "#FFFFFF");
});

test("theme caches stay isolated by account, backend and a valid saved session", () => {
    const local = authenticated();
    const theme = { preset: presets[1].id, colors: presets[1].colors };
    cacheTheme(local, "account-b", server, theme);
    assert.equal(readCachedTheme(local, "account-a", server), null);
    assert.equal(bootstrap(local).variables.size, 0);
    cacheTheme(local, "account-a", "https://other.example.test", theme);
    assert.equal(readCachedTheme(local, "account-a", server), null);
    assert.equal(bootstrap(local).variables.size, 0);
    cacheTheme(local, "account-a", server, theme);
    local.setItem("pocketbase_auth", JSON.stringify({ record: { id: "account-a" }, token: `h.${Buffer.from("{\"exp\":1}").toString("base64url")}.s` }));
    assert.equal(bootstrap(local).variables.size, 0);
    local.removeItem("pocketbase_auth");
    assert.equal(bootstrap(local).variables.size, 0);
});

test("corrupt or unreadable cache colours and unavailable storage leave the default theme intact", () => {
    const local = authenticated();
    local.setItem(THEME_CACHE_KEY, "broken");
    assert.equal(readCachedTheme(local, "account-a", server), null);
    assert.equal(bootstrap(local).variables.size, 0);
    const theme = { preset: presets[1].id, colors: presets[1].colors };
    cacheTheme(local, "account-a", server, theme);
    const cached = JSON.parse(local.getItem(THEME_CACHE_KEY)!);
    cached.variables["--primary"] = "url(https://example.test)";
    local.setItem(THEME_CACHE_KEY, JSON.stringify(cached));
    assert.equal(bootstrap(local).variables.size, 0);
    cached.variables["--primary"] = cached.variables["--background"];
    local.setItem(THEME_CACHE_KEY, JSON.stringify(cached));
    assert.equal(bootstrap(local).variables.size, 0);
    const unavailable = {
        getItem: () => { throw Error("Blocked"); },
        setItem: () => { throw Error("Blocked"); },
        removeItem: () => {},
    };
    assert.equal(readCachedTheme(unavailable, "account-a", server), null);
    assert.doesNotThrow(() => cacheTheme(unavailable, "account-a", server, theme));
    assert.equal(bootstrap(unavailable).variables.size, 0);
});
