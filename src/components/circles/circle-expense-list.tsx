"use client";

import { useWorkspace } from "../workspace-context";
import { CategoryIcon } from "../category-icon";
import type { CircleDetail } from "@/lib/circles";
import { categoryLabel, CATEGORY_COLORS, convertAmount, dayLabel, money, rateDate, recurrenceLabel, timeLabel } from "@/lib/domain";
import { SPLIT_LABELS, type CircleExpense } from "@/lib/circles";
import { CirclePagination } from "./circle-pagination";

export function CircleExpenseList({
    detail,
    onView,
    onPage,
    filtered = false,
}: {
    detail: CircleDetail;
    onView: (expense: CircleExpense) => void;
    onPage: (page: number) => void;
    filtered?: boolean;
}) {
    const { preferences, rates } = useWorkspace();
    const name = (id: string) =>
        detail.members.find((member) => member.id === id)?.name || "Former member";
    return (
        <div>
            {!detail.expenses.items.length && (
                <p className="py-12 text-center text-xs text-muted-foreground">
                    {filtered ? "No transactions match this month and filters." : "No shared transactions yet."}
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
                            className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 py-5 text-left hover:bg-white/2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4">
                            <CategoryIcon
                                category={categoryLabel(expense)}
                                color={detail.categories.find((item) => item.id === expense.category)?.color || CATEGORY_COLORS[7]}
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{expense.title}</span>
                                <span className="mt-1.5 block text-[11px] leading-5 text-muted-foreground">
                                    {categoryLabel(expense)} · {dayLabel(expense.occurred_at, preferences.timezone)} · {timeLabel(expense.occurred_at, preferences.timezone, preferences.time_format)}
                                </span>
                                <span className="mt-1 block text-[11px] leading-5 text-muted-foreground wrap-anywhere">
                                    {expense.kind === "income" ? "Received by" : "Paid by"} {expense.paid_by === detail.me ? "you" : name(expense.paid_by)} ·{" "}
                                    {expense.receipt ? "Receipt" : SPLIT_LABELS[expense.split_mode]} ·{" "}
                                    {expense.shares.length} {expense.shares.length === 1 ? "member" : "members"}
                                </span>
                                {expense.payment_method && <span className="mt-1 block truncate text-[11px] leading-5 text-muted-foreground">Payment: {expense.payment_method}</span>}
                                {expense.notes && <span className="mt-1 block truncate text-[11px] leading-5 text-muted-foreground">{expense.notes}</span>}
                                {expense.recurrence && <span className="mt-1 block text-[11px] leading-5 text-muted-foreground wrap-anywhere">{recurrenceLabel(expense)}</span>}
                            </span>
                            <span className="col-start-2 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 tabular-nums sm:col-start-3 sm:row-start-1 sm:grid-cols-1 sm:text-right">
                                <span className="min-w-0">
                                    <span className="block text-[10px] text-muted-foreground">Total {expense.kind}</span>
                                    <span className={`mt-1 block text-sm wrap-anywhere ${expense.kind === "income" ? "text-primary" : ""}`}>
                                        {expense.kind === "income" ? "+ " : ""}{money(expense.amount, expense.currency)}{" "}
                                        <span className="text-[10px] text-muted-foreground">{expense.currency}</span>
                                    </span>
                                    {expense.currency !== detail.circle.currency && (
                                        <span
                                            className="mt-1 block text-[10px] text-muted-foreground wrap-anywhere"
                                            title={`Rate date: ${rateDate(expense.currency, detail.circle.currency, rates) || "unavailable"}`}>
                                            {converted === null ? "Conversion unavailable" : `≈ ${money(converted, detail.circle.currency)} ${detail.circle.currency}`}
                                        </span>
                                    )}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[10px] text-muted-foreground">Your share</span>
                                    <span className="mt-1 block text-sm wrap-anywhere">
                                        {money(myShare, expense.currency)}{" "}
                                        <span className="text-[10px] text-muted-foreground">{expense.currency}</span>
                                    </span>
                                </span>
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
