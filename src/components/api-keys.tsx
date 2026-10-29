"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
    Check,
    Copy,
    KeyRound,
    Loader2,
    Plus,
    ShieldCheck,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./ui/alert-dialog";
import { pb, pocketbaseUrl } from "@/lib/pocketbase";
import { asDate, dayLabel, errorMessage, type ApiKey } from "@/lib/domain";

export function ApiKeys({ timezone }: { timezone: string }) {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [creating, setCreating] = useState(false);
    const [secret, setSecret] = useState("");
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [scope, setScope] = useState("write");
    const [days, setDays] = useState("90");
    const [revoke, setRevoke] = useState<ApiKey | null>(null);
    const [revision, setRevision] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        let active = true;
        pb.send<{ items: ApiKey[] }>("/api/expenditure/keys", { method: "GET" })
            .then((result) => {
                if (active) {
                    setKeys(result.items);
                    setError("");
                }
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
    }, [revision]);
    async function create(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        const name = String(
            new FormData(event.currentTarget).get("name") || "",
        ).trim();
        try {
            const result = await pb.send<{ key: string; record: ApiKey }>(
                "/api/expenditure/keys",
                {
                    method: "POST",
                    body: {
                        name,
                        scopes:
              scope === "both" ?
                      ["expenses:read", "expenses:write"] :
                      [`expenses:${scope}`],
                        expires_at: days === "never" ? "" : new Date(Date.now() + Number(days) * 86400000).toISOString(),
                    },
                },
            );
            setSecret(result.key);
            setCopied(false);
            setRevision((r) => r + 1);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    async function copy(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Clipboard access is unavailable. Select and copy the text.");
        }
    }

    async function revokeKey() {
        if (!revoke) return;
        setBusy(true);
        try {
            await pb.send(`/api/expenditure/keys/${revoke.id}`, { method: "DELETE" });
            setRevoke(null);
            setRevision((r) => r + 1);
            toast.success("API key revoked");
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    const personalExample = `curl -X POST '${pocketbaseUrl}/api/expenses/transactions' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: a-unique-transaction-id' \\
  -d '{
    "merchant": "Apartment Coffee",
    "amount": 650,
    "currency": "SGD",
    "category": "Food & drinks",
    "payment_method": "Visa",
    "notes": "Afternoon coffee"
  }'`;
    const circleExample = `curl -X POST '${pocketbaseUrl}/api/expenses/circles/CIRCLE_ID/transactions' \\
  -H 'X-API-Key: YOUR_API_KEY' \\
  -H 'Idempotency-Key: a-unique-transaction-id' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "Coffee together",
    "amount": 650,
    "currency": "SGD",
    "category": "Food & drinks",
    "payment_method": "Visa"
  }'`;
    return (
        <div className="animate-enter">
            <div className="flex items-center justify-between border-b pb-6">
                <div>
                    <h2 className="text-base font-medium">API keys</h2>
                    <p className="mt-2 text-xs leading-6 text-muted-foreground">
                        Add personal or Circle expenses, or read personal expenses from other apps.
                    </p>
                </div>
                <Button
                    className="h-10 px-4"
                    onClick={() => {
                        setError("");
                        setCreating(true);
                    }}>
                    <Plus /> Create key
                </Button>
            </div>
            {error && !creating && (
                <p role="alert" className="mt-5 text-sm text-destructive">
                    {error}
                </p>
            )}
            {loading ?
                    (
                        <div className="py-14 text-center text-muted-foreground">
                            <Loader2 className="mx-auto size-5 animate-spin" />
                        </div>
                    ) :
                keys.length ?
                        (
                            <div className="divide-y">
                                {keys.map((key) => {
                                    const expired = !!key.expires_at && asDate(key.expires_at).getTime() <= now;
                                    const inactive = !!key.revoked_at || expired;
                                    return (
                                        <div
                                            key={key.id}
                                            className="flex flex-wrap items-center gap-4 py-5">
                                            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/5 text-primary">
                                                <KeyRound className="size-4" strokeWidth={1.5} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <p className="text-sm">{key.name}</p>
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[9px] ${inactive ? "bg-secondary text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                                                        {key.revoked_at ?
                                                            "Revoked" :
                                                            expired ?
                                                                "Expired" :
                                                                "Active"}
                                                    </span>
                                                </div>
                                                <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                                                    {key.key_prefix}••••••••
                                                </p>
                                                <p className="mt-1.5 text-[10px] text-muted-foreground">
                                                    {key.scopes.join(" · ")} · {key.expires_at ?
                                                        `Expires ${dayLabel(key.expires_at, timezone)}` :
                                                        "Never expires"}
                                                </p>
                                            </div>
                                            <div className="hidden text-right text-[11px] text-muted-foreground sm:block">
                                                {key.last_used ?
                                                    `Used ${dayLabel(key.last_used, timezone)}` :
                                                    "Never used"}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Revoke ${key.name}`}
                                                disabled={inactive}
                                                onClick={() => setRevoke(key)}>
                                                <Trash2 className="size-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) :
                        (
                            <div className="flex flex-col items-center border-b py-15 text-center">
                                <KeyRound className="mb-4 size-7 text-primary/65" strokeWidth={1.2} />
                                <h3 className="font-display text-2xl">No API keys</h3>
                                <p className="mt-2 max-w-75 text-xs leading-6 text-muted-foreground">
                                    Create a key to add or read expenses from another app.
                                </p>
                            </div>
                        )}
            <div className="mt-10 space-y-10">
                <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium">Default workspace transactions</h3>
                        <p className="mt-4 text-xs leading-6 text-muted-foreground">
                            Create a key with write access and send it in the X-API-Key header.
                            Choose your Default API workspace in Settings. This request uses that workspace across all your keys.
                            Keep merchant in the body for either destination. Currency and category default to that workspace when omitted.
                        </p>
                        <p className="mt-4 flex gap-2 text-[10px] leading-5 text-muted-foreground">
                            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                            Keys are shown once and can be revoked at any time.
                        </p>
                    </div>
                    <RequestExample
                        title="Default workspace request"
                        request={personalExample}
                        onCopy={copy}
                        note="Use a unique Idempotency-Key per purchase and retain it for retries within 24 hours. Retries keep the original destination and do not extend the window. Read access still lists personal expenses only."
                    />
                </section>
                <section className="grid gap-6 border-t pt-8 lg:grid-cols-[1fr_1.2fr]">
                    <div className="min-w-0">
                        <h3 className="text-sm font-medium">Circle transactions</h3>
                        <p className="mt-4 text-xs leading-6 text-muted-foreground">
                            Use your API key with write access in the X-API-Key header.
                            You must be an active member of the Circle.
                        </p>
                        <ol className="mt-4 list-decimal space-y-3 pl-4 text-xs leading-6 text-muted-foreground">
                            <li>
                                Open the Circle in the app, open its three-dot menu, and choose Copy Circle ID.
                            </li>
                            <li>
                                Replace <code className="text-foreground">CIRCLE_ID</code> and
                                <code className="text-foreground"> YOUR_API_KEY</code> in the example.
                                Send a title and amount, plus any optional fields you need.
                            </li>
                            <li>
                                You are always the payer and initially cover 100% of the expense.
                                To share the cost, open the transaction on the website, choose Edit expense,
                                and change its split. The initial entry creates no shared debt.
                            </li>
                        </ol>
                        <p className="mt-4 text-xs leading-6 text-muted-foreground">
                            Omit currency to use the Circle currency, and category to use its default active category.
                            An explicit category must belong to that Circle. Omit
                            <code className="text-foreground"> occurred_at</code> to use the current time, or send a timestamp with a timezone.
                            Payer, split, income and recurrence fields are not accepted by this API endpoint.
                        </p>
                    </div>
                    <RequestExample
                        title="Circle transaction request"
                        request={circleExample}
                        onCopy={copy}
                        note="Idempotency-Key provides the same 24-hour retry protection as the general endpoint. Keys are shared across destinations: use a new key for each purchase. Explicit Circle requests ignore your default workspace."
                    />
                </section>
            </div>
            <Dialog
                open={creating}
                onOpenChange={(open) => {
                    if (!busy) {
                        setCreating(open);
                        if (!open) {
                            setSecret("");
                            setError("");
                        }
                    }
                }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-display text-3xl font-normal">
                            {secret ? "Your key is ready." : "Create an API key."}
                        </DialogTitle>
                        <DialogDescription>
                            {secret ?
                                "Copy this key now. You won’t be able to view it again." :
                                "Give each app or device its own key."}
                        </DialogDescription>
                    </DialogHeader>
                    {secret ?
                            (
                                <div className="space-y-5 pt-3">
                                    <div className="rounded-lg border bg-background p-4 font-mono text-xs break-all select-all">
                                        {secret}
                                    </div>
                                    <p className="text-xs leading-6 text-muted-foreground">
                                        Keep this key private. Anyone with it can use the permissions
                                        you selected.
                                    </p>
                                    <Button className="h-10 w-full" onClick={() => copy(secret)}>
                                        {copied ? <Check /> : <Copy />}
                                        {copied ? "Copied" : "Copy secret key"}
                                    </Button>
                                </div>
                            ) :
                            (
                                <form onSubmit={create} className="space-y-5 pt-3">
                                    <div>
                                        <label className="field-label" htmlFor="key-name">
                                            Key name
                                        </label>
                                        <Input
                                            id="key-name"
                                            name="name"
                                            placeholder="My automation"
                                            maxLength={80}
                                            required
                                            autoFocus
                                            className="h-11"
                                        />
                                    </div>
                                    <div>
                                        <label className="field-label" htmlFor="key-access">
                                            Permissions
                                        </label>
                                        <Select value={scope} onValueChange={setScope}>
                                            <SelectTrigger id="key-access" className="h-11! w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="write">Write · add expenses</SelectItem>
                                                <SelectItem value="read">Read · list personal expenses</SelectItem>
                                                <SelectItem value="both">Read and write</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="field-label" htmlFor="key-expiry">
                                            Expiration
                                        </label>
                                        <Select value={days} onValueChange={setDays}>
                                            <SelectTrigger id="key-expiry" className="h-11! w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[30, 90, 365].map((d) => (
                                                    <SelectItem key={d} value={String(d)}>
                                                        {d} days
                                                    </SelectItem>
                                                ))}
                                                <SelectItem value="never">Never expires</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {error && (
                                        <p role="alert" className="text-xs text-destructive">
                                            {error}
                                        </p>
                                    )}
                                    <DialogFooter>
                                        <Button type="submit" disabled={busy} className="h-10 px-5">
                                            {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}{" "}
                                            Generate key
                                        </Button>
                                    </DialogFooter>
                                </form>
                            )}
                </DialogContent>
            </Dialog>
            <AlertDialog
                open={!!revoke}
                onOpenChange={(open) => {
                    if (!open && !busy) setRevoke(null);
                }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke {revoke?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Any app using this key will immediately lose access.
                            This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>Keep key</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy}
                            onClick={(e) => {
                                e.preventDefault();
                                void revokeKey();
                            }}>
                            Revoke key
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function RequestExample({ title, request, note, onCopy }: {
    title: string;
    request: string;
    note: string;
    onCopy: (request: string) => Promise<void>;
}) {
    return (
        <div className="min-w-0 self-start overflow-hidden rounded-xl border bg-[#141713]">
            <div className="flex items-center justify-between border-b px-5 py-3">
                <span className="text-[10px] tracking-wider text-muted-foreground">
                    {title.toUpperCase()}
                </span>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Copy ${title.toLowerCase()}`}
                    onClick={() => void onCopy(request)}>
                    <Copy className="size-3.5" />
                </Button>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[11px] leading-6 text-[#c4cbb8]">
                {request.split("\n").map((line, index, lines) => (
                    <span key={index}>
                        {line}
                        {line.trimStart().startsWith("\"amount\":") && (
                            <span className="text-muted-foreground">{" // Integer minor units / cents (SGD 6.50)"}</span>
                        )}
                        {index < lines.length - 1 ? "\n" : ""}
                    </span>
                ))}
            </pre>
            <p className="border-t px-5 py-4 text-[10px] leading-5 text-muted-foreground">
                {note}
            </p>
        </div>
    );
}
