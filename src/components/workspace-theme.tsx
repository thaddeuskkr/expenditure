"use client";
import { useLayoutEffect } from "react";
import { themeVariables, type ThemePreference } from "@/lib/theme";
import { cacheTheme } from "@/lib/theme-cache";
import { pb, pocketbaseUrl } from "@/lib/pocketbase";

// Apply to the document so portalled dialogs, tooltips and toasts share the theme.
export function WorkspaceTheme({ theme, userId }: { theme: ThemePreference; userId: string }) {
    useLayoutEffect(() => {
        if (pb.authStore.record?.id !== userId || !pb.authStore.isValid) return;
        applyTheme(theme);
        try {
            cacheTheme(localStorage, userId, pocketbaseUrl, theme);
        } catch { /* Storage may be unavailable. */ }
    }, [theme, userId]);
    return null;
}

export function applyTheme(theme: ThemePreference) {
    const root = document.documentElement;
    const variables = themeVariables(theme);
    Object.entries(variables).forEach(([key, value]) => root.style.setProperty(key === "colorScheme" ? "color-scheme" : key, String(value)));
    root.classList.toggle("dark", variables.colorScheme === "dark");
    const meta = document.querySelector<HTMLMetaElement>("meta[name=\"theme-color\"]");
    if (meta) meta.content = String(variables["--background" as keyof typeof variables]);
}
