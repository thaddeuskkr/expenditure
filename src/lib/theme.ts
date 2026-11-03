import type { CSSProperties } from "react";
import { colorKeys, contrast, luminance, normalizeTheme, onAccent, type ThemePreference } from "../../pocketbase/pb_hooks/theme-core.cjs";
export { presets, colorKeys, themeError } from "../../pocketbase/pb_hooks/theme-core.cjs";
export type { ThemeColors, ThemePreference } from "../../pocketbase/pb_hooks/theme-core.cjs";

export function themeVariables(theme: ThemePreference, preview = false): CSSProperties {
    const colors = preview ? theme.colors : normalizeTheme(theme).colors;
    const minimumContrast = (color: string) => Math.min(...[colors.background, colors.surface, colors.raised].map((surface) => contrast(color, surface)));
    const destructive = minimumContrast("#E1A59C") >= minimumContrast("#9F342A") ? "#E1A59C" : "#9F342A";
    return {
        "--background": colors.background,
        "--foreground": colors.text,
        "--card": colors.surface,
        "--popover": colors.surface,
        "--popover-foreground": colors.text,
        "--primary": colors.accent,
        "--primary-foreground": onAccent(colors.accent),
        "--secondary": colors.raised,
        "--muted-foreground": colors.muted,
        "--border": `${colors.text}1F`,
        "--ring": colors.accent,
        "--destructive": destructive,
        colorScheme: luminance(colors.background) < 0.179 ? "dark" : "light",
    } as CSSProperties;
}

// PocketBase may serialize JSON object keys in a different order than the editor.
export function sameTheme(first: ThemePreference, second: ThemePreference): boolean {
    return first.preset === second.preset && colorKeys.every((key) => first.colors[key].toUpperCase() === second.colors[key].toUpperCase());
}
