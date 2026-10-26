"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import type { AuthProviderInfo } from "pocketbase";
import { Button } from "@/components/ui/button";
import { pb } from "@/lib/pocketbase";
import { errorMessage } from "@/lib/domain";
import { Brand } from "./brand";

export function SignIn() {
    const [providers, setProviders] = useState<AuthProviderInfo[]>([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    useEffect(() => {
        let active = true;
        pb.collection("users")
            .listAuthMethods()
            .then((methods) => {
                if (active) setProviders(methods.oauth2.providers);
            })
            .catch((e) => {
                if (active) setError(errorMessage(e));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);
    function signIn(provider: string) {
        setBusy(provider);
        setError("");
        pb.collection("users")
            .authWithOAuth2({ provider })
            .catch((e) => setError(errorMessage(e)))
            .finally(() => setBusy(""));
    }

    return (
        <main
            id="main-content"
            className="grid min-h-svh lg:grid-cols-[1.08fr_1fr]">
            <section
                className="relative hidden overflow-hidden border-r border-white/10 lg:block"
                aria-label="Expenditure">
                <div className="absolute inset-0 bg-[url('/images/misty-mountains.jpg')] bg-cover bg-[center_65%] saturate-30" />
                <div className="absolute inset-0 bg-linear-to-b from-[#101712]/40 via-[#101712]/15 to-[#101712]/75" />
                <div className="relative p-12">
                    <Brand />
                </div>
            </section>
            <section className="relative flex min-h-svh flex-col justify-center px-7 py-12 sm:px-16 xl:px-24">
                <div className="absolute top-9 left-7 lg:hidden">
                    <Brand />
                </div>
                <div className="mx-auto w-full max-w-88 animate-enter">
                    <h1 className="font-display text-5xl tracking-[-1px]">Sign in</h1>
                    <div className="mt-8 space-y-3">
                        {loading ?
                                (
                                    <Button className="h-12 w-full" disabled>
                                        <Loader2 className="animate-spin" />
                                        Connecting…
                                    </Button>
                                ) :
                                (
                                    providers.map((provider) => (
                                        <Button
                                            key={provider.name}
                                            className="h-12 w-full justify-between px-4"
                                            disabled={!!busy}
                                            onClick={() => signIn(provider.name)}>
                                            Continue with {provider.displayName || provider.name}
                                            {busy === provider.name ?
                                                    (
                                                        <Loader2 className="animate-spin" />
                                                    ) :
                                                    (
                                                        <ArrowRight className="size-4" />
                                                    )}
                                        </Button>
                                    ))
                                )}
                        {!loading && !providers.length && !error && (
                            <p role="alert" className="text-sm text-destructive">
                                No sign-in providers are enabled on PocketBase.
                            </p>
                        )}
                        {error && (
                            <p
                                role="alert"
                                className="rounded-lg bg-destructive/10 p-3 text-sm leading-6 text-destructive">
                                {error}
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
