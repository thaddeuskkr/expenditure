"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { pb } from "@/lib/pocketbase";
import { errorMessage, money, type Expense } from "@/lib/domain";

export function RecurringExpenses({ onEdit }: { onEdit: (expense: Expense) => void }) {
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
            <h2 className="border-b pb-4 text-sm font-medium">Recurring expenses</h2>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            {!rows.length && !error && <p className="text-xs text-muted-foreground">Enable recurring expenses when adding or editing an expense.</p>}
            {rows.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between gap-4 border-b pb-4">
                    <div className="min-w-0 text-xs">
                        <p className="break-words">{expense.merchant} · {money(expense.amount, expense.currency)} {expense.currency}</p>
                        <p className="mt-2 text-muted-foreground">{expense.recurrence} · Next {new Date(expense.recurrence_next).toLocaleString("en-SG", { timeZone: expense.recurrence_timezone })}</p>
                        {expense.recurrence_error && <p className="mt-2 text-destructive">Paused: {expense.recurrence_error}</p>}
                    </div>
                    <Button variant="outline" onClick={() => onEdit(expense)}>Edit</Button>
                </div>
            ))}
        </section>
    );
}
