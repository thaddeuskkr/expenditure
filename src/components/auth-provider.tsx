"use client";
import {
    createContext,
    useContext,
    useEffect,
    useState,
    useSyncExternalStore,
} from "react";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pocketbase";
const AuthContext = createContext<{
    user: RecordModel | null;
    ready: boolean;
    signOut: () => void;
}>({ user: null, ready: false, signOut: () => {} });
function subscribe(callback: () => void) {
    return pb.authStore.onChange(callback);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const token = useSyncExternalStore(
        subscribe,
        () => pb.authStore.token,
        () => "",
    );
    const [ready, setReady] = useState(false);
    useEffect(() => {
        let active = true;
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
        };
    }, []);
    return (
        <AuthContext.Provider
            value={{
                user: token && pb.authStore.isValid ? pb.authStore.record : null,
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
