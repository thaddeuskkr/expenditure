"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Copy, Ellipsis, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useWorkspace } from "../workspace-context";
import { useAuth } from "../auth-provider";
import { dateTimeLabel, dayLabel, errorMessage, money, recurrenceLabel } from "@/lib/domain";
import {
    circlesApi,
    type CircleSettlement,
    type CircleMember,
    type CircleInvitation,
    invitationLink,
    type CircleDetail,
    type CircleExpense,
    type CircleIndex,
    type SettlementSuggestion,
} from "@/lib/circles";
import { CircleIcon } from "./circle-icon";
import { CircleExpenseList } from "./circle-expense-list";
import { CircleBalances } from "./circle-balances";
import { CircleMembers } from "./circle-members";
import {
    CircleConfirmDialog,
    CircleSettingsDialog,
    CurrencySelect,
    FormError,
    InviteDialog,
    TransferDialog,
} from "./circle-dialogs";
import { CircleCategorySettings } from "./circle-category-settings";
import { CircleExpenseEditor } from "./circle-expense-editor";
import { CircleExpenseDetails } from "./circle-expense-details";
import { MoveToPersonalDialog } from "./move-to-personal-dialog";
import { SettlementDialog } from "./settlement-dialog";

type Confirmation = {
    title: string;
    description: string;
    label: string;
    confirmationName?: string;
    action: (name: string) => Promise<void>;
};

export function CirclesView({ initialCircle, onTransactionMoved }: { initialCircle?: string; onTransactionMoved: () => void }) {
    const { preferences } = useWorkspace();
    const { user } = useAuth();
    const [index, setIndex] = useState<CircleIndex | null>(null),
        [data, setData] = useState<CircleDetail | null>(null);
    const [selected, setSelected] = useState<string | null>(initialCircle || null);
    const [tab, setTab] = useState<"Expenses" | "Balances" | "Members">("Expenses");
    const [expensePage, setExpensePage] = useState(1),
        [settlementPage, setSettlementPage] = useState(1);
    const [revision, setRevision] = useState(0),
        [loading, setLoading] = useState(true),
        [error, setError] = useState("");
    const [dialog, setDialog] = useState<"create" | "settings" | "categories" | "invite" | "transfer" | null>(
        null,
    );
    const [editor, setEditor] = useState<CircleExpense | "new" | "income" | null>(null),
        [viewing, setViewing] = useState<CircleExpense | null>(null);
    const [moving, setMoving] = useState<CircleExpense | null>(null);
    const [settlement, setSettlement] = useState<SettlementSuggestion | CircleSettlement | null>(null),
        [confirmation, setConfirmation] = useState<Confirmation | null>(null);
    const [filterCurrency, setFilterCurrency] = useState("");
    const refresh = useCallback(() => setRevision((value) => value + 1), []);
    useEffect(() => {
        const timer = setInterval(() => {
            if (document.visibilityState === "visible") refresh();
        }, 20000);
        window.addEventListener("focus", refresh);
        return () => {
            clearInterval(timer);
            window.removeEventListener("focus", refresh);
        };
    }, [refresh]);
    useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true);
            try {
                const [nextIndex, nextDetail] = await Promise.all([
                    circlesApi.list(),
                    selected ?
                            circlesApi.detail(selected, expensePage, settlementPage) :
                            Promise.resolve(null),
                ]);
                if (active) {
                    setIndex(nextIndex);
                    setData(nextDetail);
                    setError("");
                }
            } catch (e) {
                if (active) setError(errorMessage(e));
            } finally {
                if (active) setLoading(false);
            }
        }

        void load();
        return () => {
            active = false;
        };
    }, [selected, expensePage, settlementPage, revision]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (
                data?.circle.id !== selected ||
                event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey ||
                (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable]")) ||
                document.querySelector("[role=\"dialog\"]")
            ) return;
            event.preventDefault();
            setEditor("new");
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [data, selected]);
    function open(id: string | null) {
        setSelected(id);
        setExpensePage(1);
        setSettlementPage(1);
        setFilterCurrency("");
        setTab("Expenses");
    }

    const detail = data?.circle.id === selected ? data : null;
    const currencies = [
        ...new Set([
            detail?.circle.currency || preferences.currency,
            ...(detail?.totals.map((row) => row.currency) || []),
            ...(detail?.balances.map((row) => row.currency) || []),
        ]),
    ];
    const currency = currencies.includes(filterCurrency) ?
        filterCurrency :
        detail?.circle.currency || preferences.currency;
    const ownBalance =
        detail?.balances.find((row) => row.member === detail.me && row.currency === currency)
            ?.net || 0;
    const summary = detail?.totals.find((row) => row.currency === currency);
    const canModify = (createdBy: string) =>
        !!detail && (detail.circle.is_owner || createdBy === detail.me);
    async function copyLink(id: string) {
        try {
            await navigator.clipboard.writeText(invitationLink(id));
            toast.success("Invitation link copied");
        } catch {
            toast.error(
                "Clipboard access is unavailable. Create a new invitation to select its link.",
            );
        }
    }

    function removeExpense(expense: CircleExpense) {
        setViewing(null);
        setConfirmation({
            title: `Delete shared ${expense.kind}?`,
            description: `${expense.title} · ${money(expense.amount, expense.currency)} ${expense.currency}. Member balances will be recalculated.${expense.recurrence ? " Future recurring entries will stop; existing entries remain." : ""}`,
            label: `Delete ${expense.kind}`,
            action: async () => {
                await circlesApi.deleteExpense(selected!, expense);
                refresh();
            },
        });
    }

    function undoSettlement(payment: CircleSettlement) {
        setConfirmation({
            title: "Undo recorded settlement?",
            description:
                "The repayment record will be removed and member balances recalculated. No money will be moved.",
            label: "Undo settlement",
            action: async () => {
                await circlesApi.undoSettlement(selected!, payment);
                refresh();
            },
        });
    }

    function removeMember(member: CircleMember) {
        setConfirmation({
            title: `Remove ${member.name}?`,
            description: "They will lose access. Their shared expense history will remain.",
            label: "Remove member",
            action: async () => {
                await circlesApi.removeMember(selected!, member.id);
                refresh();
            },
        });
    }

    function revokeInvitation(invitation: CircleInvitation) {
        setConfirmation({
            title: "Revoke invitation?",
            description: invitation.email,
            label: "Revoke",
            action: async () => {
                await circlesApi.revoke(invitation.id);
                refresh();
            },
        });
    }

    async function copyCircleId() {
        if (!detail) return;
        try {
            await navigator.clipboard.writeText(detail.circle.id);
            toast.success("Circle ID copied");
        } catch {
            toast.error("Could not copy Circle ID", { description: detail.circle.id });
        }
    }

    return (
        <section className="space-y-8 animate-enter">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {selected ?
                        (
                            <Button variant="ghost" onClick={() => open(null)} className="-ml-3">
                                <ArrowLeft />
                                All circles
                            </Button>
                        ) :
                        (
                            <p className="text-xs text-muted-foreground">
                                {index?.circles.length || 0} circles
                            </p>
                        )}
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Refresh circles"
                        onClick={refresh}
                        disabled={loading}>
                        <RefreshCw className={loading ? "animate-spin" : ""} />
                    </Button>
                    {!selected && (
                        <Button onClick={() => setDialog("create")}>
                            <Plus />
                            Create circle
                        </Button>
                    )}
                </div>
            </div>
            {error && (
                <div className="rounded-lg border border-destructive/25 p-4">
                    <FormError error={error} />
                    <Button variant="outline" className="mt-3" onClick={refresh}>
                        Try again
                    </Button>
                </div>
            )}
            {loading && !index && (
                <div className="grid min-h-48 place-items-center">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
            )}
            {!selected && index && !error && (
                <>
                    {index.invitations.length > 0 && (
                        <div>
                            <h2 className="mb-2 text-sm font-medium">Invitations</h2>
                            <div className="divide-y border-y">
                                {index.invitations.map((invitation) => (
                                    <div
                                        key={invitation.id}
                                        className="flex flex-wrap items-center gap-4 py-5">
                                        <CircleIcon name={invitation.expand.circle.icon} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm">
                                                {invitation.expand.circle.name}
                                            </p>
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                                Expires{" "}
                                                {dayLabel(
                                                    invitation.expires_at,
                                                    preferences.timezone,
                                                )}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            onClick={() =>
                                                setConfirmation({
                                                    title: "Decline invitation?",
                                                    description: invitation.expand.circle.name,
                                                    label: "Decline",
                                                    action: async () => {
                                                        await circlesApi.revoke(invitation.id);
                                                        refresh();
                                                    },
                                                })}>
                                            Decline
                                        </Button>
                                        <Button
                                            onClick={() =>
                                                void circlesApi
                                                    .accept(invitation.id)
                                                    .then((result) => {
                                                        open(result.circle);
                                                        refresh();
                                                    })
                                                    .catch((e) => toast.error(errorMessage(e)))}>
                                            Join circle
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="divide-y border-t">
                        {index.circles.map((circle) => (
                            <button
                                key={circle.id}
                                onClick={() => open(circle.id)}
                                className="group flex w-full items-center gap-4 py-6 text-left transition-colors hover:bg-white/2">
                                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-primary/4 text-primary">
                                    <CircleIcon name={circle.icon} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-display text-2xl">
                                        {circle.name}
                                    </span>
                                    <span className="mt-1 block text-[11px] text-muted-foreground">
                                        {circle.member_count}{" "}
                                        {circle.member_count === 1 ? "member" : "members"} ·{" "}
                                        {circle.currency}
                                        {circle.is_owner ? " · Owner" : ""}
                                    </span>
                                </span>
                                <ArrowRight className="mr-2 size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                            </button>
                        ))}
                    </div>
                    {!index.circles.length && (
                        <div className="py-12 text-center">
                            <CircleIcon
                                name="users"
                                className="mx-auto mb-4 size-8 text-primary/60"
                            />
                            <h2 className="font-display text-3xl">No circles</h2>
                            <p className="mt-3 text-xs text-muted-foreground">
                                Create a circle to split expenses and income with friends.
                            </p>
                            <Button
                                className="mt-6"
                                variant="outline"
                                onClick={() => setDialog("create")}>
                                <Plus />
                                Create circle
                            </Button>
                        </div>
                    )}
                </>
            )}
            {selected && !detail && !error && (
                <div className="grid min-h-48 place-items-center">
                    <Loader2 className="size-5 animate-spin" />
                </div>
            )}
            {detail && !error && (
                <>
                    <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="flex min-w-0 basis-full items-center gap-4 sm:flex-1 sm:basis-auto">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-primary/4 text-primary">
                                <CircleIcon name={detail.circle.icon} />
                            </span>
                            <div className="min-w-0">
                                <h2 className="font-display text-3xl break-words sm:text-4xl">
                                    {detail.circle.name}
                                </h2>
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                    {detail.circle.member_count} {detail.circle.member_count === 1 ? "member" : "members"}
                                    {detail.circle.is_owner ? " · You own this circle" : ""}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => setEditor("income")}><Plus /> Add income</Button>
                            <Button onClick={() => setEditor("new")}>
                                <Plus />
                                Add expense
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Circle actions">
                                        <Ellipsis />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-max max-w-(--radix-dropdown-menu-content-available-width) whitespace-nowrap">
                                    <DropdownMenuItem onClick={() => void copyCircleId()}>
                                        <Copy /> Copy Circle ID
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {detail.circle.is_owner ?
                                            (
                                                <>
                                                    <DropdownMenuItem onClick={() => setDialog("settings")}>
                                                        Rename, icon & currency
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setDialog("categories")}>Categories</DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setDialog("invite")}>
                                                        Invite member
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setDialog("transfer")}>
                                                        Transfer ownership
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() =>
                                                            setConfirmation({
                                                                title: "Delete circle?",
                                                                description:
                                                            "This permanently deletes the circle, shared expenses, invitations, settlements, and balances for every member. This cannot be undone.",
                                                                label: "Delete circle",
                                                                confirmationName: detail.circle.name,
                                                                action: async (confirmation) => {
                                                                    await circlesApi.remove(
                                                                        detail.circle,
                                                                        confirmation,
                                                                    );
                                                                    open(null);
                                                                    refresh();
                                                                },
                                                            })}>
                                                        Delete circle
                                                    </DropdownMenuItem>
                                                </>
                                            ) :
                                            (
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    disabled={detail.balances.some(
                                                        (row) => row.member === detail.me && row.net !== 0,
                                                    )}
                                                    onClick={() =>
                                                        setConfirmation({
                                                            title: "Leave circle?",
                                                            description:
                                                        "You will lose access. Your shared expense history will remain.",
                                                            label: "Leave circle",
                                                            action: async () => {
                                                                await circlesApi.removeMember(
                                                                    detail.circle.id,
                                                                    detail.me,
                                                                );
                                                                open(null);
                                                                refresh();
                                                            },
                                                        })}>
                                                    Leave circle
                                                </DropdownMenuItem>
                                            )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex gap-5 border-b">
                            {(["Expenses", "Balances", "Members"] as const).map((item) => (
                                <button
                                    key={item}
                                    onClick={() => setTab(item)}
                                    aria-pressed={tab === item}
                                    className={`border-b-2 py-3 text-xs transition-colors ${tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                                    {item === "Expenses" ? "Transactions" : item}
                                </button>
                            ))}
                        </div>
                        <div className="max-w-64">
                            <label className="sr-only" htmlFor="circle-view-currency">
                                Balance currency
                            </label>
                            <CurrencySelect
                                id="circle-view-currency"
                                value={currency}
                                onChange={setFilterCurrency}
                                codes={currencies}
                            />
                        </div>
                    </div>
                    {tab !== "Members" && (
                        <div className="grid grid-cols-2 gap-6 border-b pb-7 sm:gap-12">
                            <div>
                                <p className="eyebrow text-[9px]">Total spent · {currency}</p>
                                <p className="mt-3 font-display text-4xl sm:text-5xl">
                                    {money(summary?.total || 0, currency)}
                                </p>
                                <p className="mt-2 text-[10px] text-muted-foreground">
                                    {summary?.count || 0} {summary?.count === 1 ? "expense" : "expenses"} in {currency}
                                </p>
                                <p className="mt-2 text-[10px] text-primary">Income {money(summary?.income || 0, currency)}
                                </p>
                            </div>
                            <div>
                                <p className="eyebrow text-[9px]">
                                    {ownBalance > 0 ?
                                        "You are owed" :
                                        ownBalance < 0 ?
                                            "You owe" :
                                            "Your balance"}{" "}
                                    · {currency}
                                </p>
                                <p
                                    className={`mt-3 font-display text-4xl sm:text-5xl ${ownBalance < 0 ? "text-[#d6b79a]" : "text-primary"}`}>
                                    {money(Math.abs(ownBalance), currency)}
                                </p>
                                <p className="mt-2 text-[10px] text-muted-foreground">
                                    Balances stay separate by currency.
                                </p>
                            </div>
                        </div>
                    )}
                    {tab === "Expenses" && detail.recurring.length > 0 && (
                        <div className="space-y-3 border-b pb-5">
                            <h3 className="text-xs font-medium">Recurring transactions</h3>
                            {detail.recurring.map((item) => (
                                <button key={item.id} className="block w-full text-left text-xs text-muted-foreground" onClick={() => setViewing(item)}>
                                    {item.title} · {item.kind === "income" ? "Income" : "Expense"} · {recurrenceLabel(item)} · {item.recurrence_error ? `Paused: ${item.recurrence_error}` : `Next ${dateTimeLabel(item.recurrence_next, item.recurrence_timezone, preferences.time_format)}`}
                                </button>
                            ))}
                        </div>
                    )}
                    {tab === "Expenses" && (
                        <CircleExpenseList
                            detail={detail}
                            onView={setViewing}
                            onPage={setExpensePage}
                        />
                    )}
                    {tab === "Balances" && (
                        <CircleBalances
                            detail={detail}
                            currency={currency}
                            onSettle={setSettlement}
                            onEdit={setSettlement}
                            onUndo={undoSettlement}
                            onPage={setSettlementPage}
                        />
                    )}
                    {tab === "Members" && (
                        <CircleMembers
                            detail={detail}
                            onInvite={() => setDialog("invite")}
                            onCopy={copyLink}
                            onRemove={removeMember}
                            onRevoke={revokeInvitation}
                        />
                    )}
                </>
            )}
            {dialog === "create" && (
                <CircleSettingsDialog
                    circle={null}
                    currency={preferences.currency}
                    onClose={() => setDialog(null)}
                    onSaved={(id) => {
                        open(id);
                        refresh();
                    }}
                />
            )}
            {detail && dialog === "categories" && <CircleCategorySettings data={detail} onClose={() => setDialog(null)} onSaved={refresh} />}
            {detail && dialog === "settings" && (
                <CircleSettingsDialog
                    circle={detail.circle}
                    currency={detail.circle.currency}
                    onClose={() => setDialog(null)}
                    onSaved={refresh}
                />
            )}
            {detail && dialog === "invite" && (
                <InviteDialog
                    circle={detail.circle}
                    onClose={() => setDialog(null)}
                    onSaved={refresh}
                />
            )}
            {detail && dialog === "transfer" && (
                <TransferDialog data={detail} onClose={() => setDialog(null)} onSaved={refresh} />
            )}
            {detail && editor && (
                <CircleExpenseEditor
                    data={detail}
                    expense={typeof editor === "string" ? null : editor}
                    kind={editor === "income" ? "income" : "expense"}
                    onClose={() => setEditor(null)}
                    onSaved={() => {
                        refresh();
                        toast.success("Shared entry saved");
                    }}
                />
            )}
            {detail && settlement && (
                <SettlementDialog
                    data={detail}
                    suggestion={settlement}
                    settlement={"id" in settlement ? settlement : undefined}
                    onClose={() => setSettlement(null)}
                    onSaved={() => {
                        refresh();
                        toast.success("id" in settlement ? "Repayment updated" : "Settlement recorded");
                    }}
                />
            )}
            {confirmation && (
                <CircleConfirmDialog
                    title={confirmation.title}
                    description={confirmation.description}
                    label={confirmation.label}
                    confirmationName={confirmation.confirmationName}
                    onClose={() => setConfirmation(null)}
                    onConfirm={confirmation.action}
                />
            )}
            {detail && viewing && (
                <CircleExpenseDetails
                    expense={viewing}
                    detail={detail}
                    onClose={() => setViewing(null)}
                    onMove={user && detail.members.find((member) => member.id === viewing.paid_by)?.user === user.id ?
                            () => {
                                setMoving(viewing);
                                setViewing(null);
                            } :
                        undefined}
                    onDelete={canModify(viewing.created_by) ? () => removeExpense(viewing) : undefined}
                    onEdit={canModify(viewing.created_by) ?
                            () => {
                                setEditor(viewing);
                                setViewing(null);
                            } :
                        undefined}
                />
            )}
            {detail && moving && (
                <MoveToPersonalDialog
                    circle={detail.circle.id}
                    expense={moving}
                    onClose={() => setMoving(null)}
                    onMoved={() => {
                        refresh();
                        onTransactionMoved();
                        toast.success(`${moving.kind === "income" ? "Income" : "Expense"} moved to personal`);
                    }}
                />
            )}
        </section>
    );
}
