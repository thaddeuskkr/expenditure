"use client";

import { useWorkspace } from "../workspace-context";
import type { CircleDetail } from "@/lib/circles";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { UserAvatar } from "../user-avatar";
import { dayLabel, money } from "@/lib/domain";
import type { CircleSettlement, SettlementSuggestion } from "@/lib/circles";
import { CirclePagination } from "./circle-pagination";

export function CircleBalances({
    detail,
    currency,
    onSettle,
    onEdit,
    onUndo,
    onPage,
}: {
    detail: CircleDetail;
    currency: string;
    onSettle: (suggestion: SettlementSuggestion) => void;
    onEdit: (settlement: CircleSettlement) => void;
    onUndo: (settlement: CircleSettlement) => void;
    onPage: (page: number) => void;
}) {
    const { preferences } = useWorkspace();
    const name = (id: string) =>
        detail.members.find((member) => member.id === id)?.name || "Former member";
    const canModify = (createdBy: string) => detail.circle.is_owner || createdBy === detail.me;
    return (
        <div className="space-y-9">
            <div className="divide-y">
                {detail.members
                    .filter(
                        (member) =>
                            member.active ||
                            detail.balances.some(
                                (row) =>
                                    row.member === member.id &&
                                    row.currency === currency &&
                                    row.net,
                            ),
                    )
                    .map((member) => {
                        const balance =
                            detail.balances.find(
                                (row) => row.member === member.id && row.currency === currency,
                            )?.net || 0;
                        return (
                            <div key={member.id} className="flex items-center gap-3 py-4">
                                {member.expand.user && (
                                    <UserAvatar user={member.expand.user} name={member.name} />
                                )}
                                <span className="min-w-0 flex-1 truncate text-xs">
                                    {member.name}
                                    {member.id === detail.me ? " (you)" : ""}
                                </span>
                                <span
                                    className={`text-right text-xs tabular-nums ${balance < 0 ? "text-[#d6b79a]" : "text-primary"}`}>
                                    {balance === 0 ?
                                        "Settled" :
                                        `${balance > 0 ? "Gets back" : "Owes"} ${money(Math.abs(balance), currency)} ${currency}`}
                                </span>
                            </div>
                        );
                    })}
            </div>
            <div>
                <h3 className="mb-3 text-sm font-medium">Suggested settlements · {currency}</h3>
                {!detail.suggestions.some((row) => row.currency === currency) && (
                    <p className="text-xs text-muted-foreground">
                        No outstanding balance in {currency}.
                    </p>
                )}
                <div className="divide-y">
                    {detail.suggestions
                        .filter((row) => row.currency === currency)
                        .map((suggestion) => (
                            <div
                                key={`${suggestion.from_member}-${suggestion.to_member}`}
                                className="flex flex-wrap items-center gap-3 py-4">
                                <span className="min-w-0 flex-1 text-xs">
                                    {name(suggestion.from_member)}{" "}
                                    <ArrowRight className="mx-2 inline size-3 text-muted-foreground" />
                                    {name(suggestion.to_member)}
                                </span>
                                <span className="text-xs tabular-nums">
                                    {money(suggestion.amount, currency)} {currency}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        !detail.circle.is_owner &&
                                        suggestion.from_member !== detail.me &&
                                        suggestion.to_member !== detail.me
                                    }
                                    onClick={() => onSettle(suggestion)}>
                                    Record
                                </Button>
                            </div>
                        ))}
                </div>
            </div>
            <div>
                <h3 className="mb-3 text-sm font-medium">Recorded repayments</h3>
                {!detail.settlements.items.length && (
                    <p className="text-xs text-muted-foreground">No repayments recorded.</p>
                )}
                <div className="divide-y">
                    {detail.settlements.items.map((payment) => (
                        <div key={payment.id} className="flex items-center gap-4 py-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs">
                                    {name(payment.from_member)} paid {name(payment.to_member)}
                                </p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                    {dayLabel(payment.occurred_at, preferences.timezone)}
                                    {payment.notes ? ` · ${payment.notes}` : ""}
                                </p>
                            </div>
                            <span className="text-xs tabular-nums">
                                {money(payment.amount, payment.currency)} {payment.currency}
                            </span>
                            {canModify(payment.created_by) && (
                                <div className="flex shrink-0 items-center gap-1">
                                    <Button variant="ghost" size="sm" aria-label={`Edit repayment from ${name(payment.from_member)} to ${name(payment.to_member)}`} onClick={() => onEdit(payment)}>
                                        Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => onUndo(payment)}>
                                        Undo
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <CirclePagination
                    page={detail.settlements.page}
                    totalPages={detail.settlements.totalPages}
                    label="settlements"
                    onPage={onPage}
                />
            </div>
        </div>
    );
}
