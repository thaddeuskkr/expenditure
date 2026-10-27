"use client";

import { useWorkspace } from "../workspace-context";
import { CategoryIcon } from "../category-icon";
import type { CircleDetail } from "@/lib/circles";
import { CATEGORY_COLORS, convertAmount, dayLabel, money, rateDate, timeLabel } from "@/lib/domain";
import { SPLIT_LABELS, type CircleExpense } from "@/lib/circles";
import { CirclePagination } from "./circle-pagination";

export function CircleExpenseList({
    detail,
    onView,
    onPage,
}: {
    detail: CircleDetail;
    onView: (expense: CircleExpense) => void;
    onPage: (page: number) => void;
}) {
    const { preferences, rates } = useWorkspace();
    const name = (id: string) =>
        detail.members.find((member) => member.id === id)?.name || "Former member";
    return (
        <div>
            {!detail.expenses.items.length && (
                <p className="py-12 text-center text-xs text-muted-foreground">
                    No shared transactions yet.
                </p>
            )}
            <div className="divide-y">
                {detail.expenses.items.map((expense) => {
                    const myShare =
                        expense.shares.find((share) => share.member === detail.me)?.amount ||
                        0;
                    const converted =
                        expense.currency !== detail.circle.currency ?
                                convertAmount(
                                    expense.amount,
                                    expense.currency,
                                    detail.circle.currency,
                                    rates,
                                ) :
                            null;
                    return (
                        <button
                            key={expense.id}
                            onClick={() => onView(expense)}
                            className="flex w-full items-center gap-3 py-5 text-left hover:bg-white/2 sm:gap-4">
                            <CategoryIcon
                                category={expense.category}
                                color={detail.categories.find((item) => item.name === expense.category)?.color || CATEGORY_COLORS[7]}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{expense.title}</span>
                                <span className="mt-2 block text-[10px] text-muted-foreground">
                                    {name(expense.paid_by)} {expense.kind === "income" ? "received" : "paid"} ·{" "}
                                    {dayLabel(expense.occurred_at, preferences.timezone)} · {timeLabel(expense.occurred_at, preferences.timezone)} ·{" "}
                                    {SPLIT_LABELS[expense.split_mode]}
                                </span>
                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                    {expense.category}
                                </span>
                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                    Your share: {money(myShare, expense.currency)}{" "}
                                    {expense.currency}
                                </span>
                            </span>
                            <span className="shrink-0 text-right text-sm tabular-nums">
                                {expense.kind === "income" ? "+ " : ""}{money(expense.amount, expense.currency)}{" "}
                                <span className="text-[10px] text-muted-foreground">
                                    {expense.currency}
                                </span>
                                {expense.currency !== detail.circle.currency && (
                                    <span
                                        className="mt-1 block text-[10px] text-muted-foreground"
                                        title={`Rate date: ${rateDate(expense.currency, detail.circle.currency, rates) || "unavailable"}`}>
                                        {converted === null ? "Conversion unavailable" : `≈ ${money(converted, detail.circle.currency)} ${detail.circle.currency}`}
                                    </span>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
            <CirclePagination
                page={detail.expenses.page}
                totalPages={detail.expenses.totalPages}
                label="transactions"
                onPage={onPage}
            />
        </div>
    );
}
