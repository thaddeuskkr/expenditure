import assert from "node:assert/strict";
import { test } from "node:test";
import { sameTheme } from "../src/lib/theme.ts";
import { contrast, normalizeTheme, onAccent, presets, themeError } from "../pocketbase/pb_hooks/theme-core.cjs";

test("theme presets seed readable custom palettes and opaque button foregrounds", () => {
    for (const preset of presets) {
        assert.equal(themeError({ preset: "custom", colors: preset.colors }), "");
        assert.ok(contrast(preset.colors.accent, onAccent(preset.colors.accent)) >= 4.5);
        assert.deepEqual(normalizeTheme({ preset: preset.id, colors: { ...preset.colors, accent: "#000000" } }), { preset: preset.id, colors: preset.colors });
    }
});

test("custom light themes are valid and text and interactive colours stay readable", () => {
    const theme = { preset: "custom", colors: { background: "#FFFFFF", surface: "#F5F5F5", raised: "#EEEEEE", accent: "#174EA6", text: "#111111", muted: "#444444" } };
    assert.equal(themeError(theme), "");
    assert.equal(onAccent(theme.colors.accent), "#FFFFFF");
    for (const key of ["text", "muted", "accent"]) {
        assert.notEqual(themeError({ ...theme, colors: { ...theme.colors, [key]: "#FFFFFF" } }), "");
    }
});

test("theme draft comparisons ignore JSON property order and hex capitalization", () => {
    const saved = { preset: "custom" as const, colors: presets[1].colors };
    const reordered = { preset: "custom" as const, colors: Object.fromEntries(Object.entries(saved.colors).reverse().map(([key, value]) => [key, value.toLowerCase()])) as typeof saved.colors };
    assert.equal(sameTheme(saved, reordered), true);
    assert.equal(sameTheme(saved, { ...reordered, colors: { ...reordered.colors, accent: "#FFFFFF" } }), false);
});
