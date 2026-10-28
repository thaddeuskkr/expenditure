"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { pb } from "@/lib/pocketbase";
import { dateTimeLabel, errorMessage, money, recurrenceLabel, type Expense } from "@/lib/domain";
import { useWorkspace } from "./workspace-context";

export function RecurringTransactions({ onEdit }: { onEdit: (expense: Expense) => void }) {
    const { preferences } = useWorkspace();
    const [rows, setRows] = useState<Expense[]>([]);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        pb.collection<Expense>("expenses").getFullList({ filter: "recurrence != ''", sort: "recurrence_next,id" }).then((items) => {
            if (active) setRows(items);
        }).catch((failure) => { if (active) setError(errorMessage(failure)); });
        return () => {
            active = false;
        };
    }, []);
    return (
        <section className="space-y-4">
            <h2 className="border-b pb-4 text-sm font-medium">Recurring transactions</h2>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            {!rows.length && !error && <p className="text-xs text-muted-foreground">Set a repeat schedule when adding or editing income or an expense.</p>}
            {rows.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between gap-4 border-b pb-4">
                    <div className="min-w-0 text-xs">
                        <p className="wrap-anywhere">{expense.merchant} · <span className={expense.kind === "income" ? "text-primary" : ""}>{expense.kind === "income" ? "+ " : ""}{money(expense.amount, expense.currency)} {expense.currency}</span></p>
                        <p className="mt-2 text-muted-foreground">{expense.kind === "income" ? "Income" : "Expense"} · {recurrenceLabel(expense)} · Next {dateTimeLabel(expense.recurrence_next, expense.recurrence_timezone, preferences.time_format)}</p>
                        {expense.recurrence_error && <p className="mt-2 text-destructive">Paused: {expense.recurrence_error}</p>}
                    </div>
                    <Button variant="outline" onClick={() => onEdit(expense)}>Edit</Button>
                </div>
            ))}
        </section>
    );
}
