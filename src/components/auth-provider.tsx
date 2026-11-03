"use client";
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    useSyncExternalStore,
} from "react";
import type { RecordModel } from "pocketbase";
import { pb, pocketbaseUrl } from "@/lib/pocketbase";
import { readCachedTheme, THEME_CACHE_KEY } from "@/lib/theme-cache";
import { presets } from "@/lib/theme";
import { applyTheme } from "./workspace-theme";
const AuthContext = createContext<{
    user: RecordModel | null;
    ready: boolean;
    signOut: () => void;
}>({ user: null, ready: false, signOut: () => {} });
function subscribe(callback: () => void) {
    return pb.authStore.onChange(callback);
}

function authSnapshot() {
    // LocalAuthStore parses a new record object on each read. A string snapshot
    // stays stable while still detecting avatar/profile changes with the same token.
    return JSON.stringify({ token: pb.authStore.token, record: pb.authStore.record });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const snapshot = useSyncExternalStore(
        subscribe,
        authSnapshot,
        () => "",
    );
    const auth = useMemo<{ token: string; record: RecordModel | null }>(
        () => snapshot ? JSON.parse(snapshot) : { token: "", record: null },
        [snapshot],
    );
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let active = true;
        let account = pb.authStore.isValid ? pb.authStore.record?.id || "" : "";
        function restoreTheme(userId: string) {
            let cached = null;
            try {
                cached = readCachedTheme(localStorage, userId, pocketbaseUrl);
                if (!cached) localStorage.removeItem(THEME_CACHE_KEY);
            } catch { /* Storage may be unavailable. */ }

            applyTheme(cached || { preset: "mauve", colors: presets[0].colors });
        }

        restoreTheme(account);
        const unsubscribe = pb.authStore.onChange(() => {
            const next = pb.authStore.isValid ? pb.authStore.record?.id || "" : "";
            if (next !== account) {
                account = next;
                restoreTheme(next);
            }
        });
        const refresh = async () => {
            if (pb.authStore.isValid) {
                try {
                    await pb.collection("users").authRefresh();
                } catch (error) {
                    const status = (error as { status?: number }).status;
                    if (status === 401 || status === 403) pb.authStore.clear();
                }
            } else if (pb.authStore.token) pb.authStore.clear();
            if (active) setReady(true);
        };

        void refresh();
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);
    return (
        <AuthContext.Provider
            value={{
                user: auth.token && pb.authStore.isValid ? auth.record : null,
                ready,
                signOut: () => pb.authStore.clear(),
            }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
