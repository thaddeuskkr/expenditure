const presets = require("./theme-presets.json");
const colorKeys = ["background", "surface", "raised", "accent", "text", "muted"];
function luminance(hex) {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function themeError(theme) {
    if (!theme || typeof theme !== "object" || Array.isArray(theme) ||
        Object.keys(theme).sort().join(",") !== "colors,preset" ||
        (theme.preset !== "custom" && !presets.some((item) => item.id === theme.preset)))
        return "Choose a theme preset or Custom.";
    const colors = theme.colors;
    if (!colors || typeof colors !== "object" || Array.isArray(colors) ||
        Object.keys(colors).sort().join(",") !== [...colorKeys].sort().join(",") ||
        colorKeys.some((key) => typeof colors[key] !== "string" || !/^#[a-fA-F0-9]{6}$/.test(colors[key])))
        return "Provide all six theme colours as #RRGGBB values.";
    if (theme.preset !== "custom") return "";
    for (const surface of ["background", "surface", "raised"]) {
        if (contrast(colors.text, colors[surface]) < 4.5 || contrast(colors.muted, colors[surface]) < 4.5)
            return "Text and secondary text need more contrast against each background (at least 4.5:1).";
        if (contrast(colors.accent, colors[surface]) < 4.5)
            return "The accent needs more contrast against each background (at least 4.5:1).";
    }

    return "";
}

function normalizeTheme(theme) {
    const error = themeError(theme);
    if (error) throw new Error(error);
    const colors = theme.preset === "custom" ? theme.colors : presets.find((item) => item.id === theme.preset).colors;
    return { preset: theme.preset, colors: Object.fromEntries(colorKeys.map((key) => [key, colors[key].toUpperCase()])) };
}

function onAccent(accent) {
    return contrast(accent, "#000000") >= contrast(accent, "#FFFFFF") ? "#000000" : "#FFFFFF";
}

module.exports = { presets, colorKeys, luminance, contrast, themeError, normalizeTheme, onAccent };
