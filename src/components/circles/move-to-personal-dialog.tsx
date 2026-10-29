"use client";

import { useState, type FormEvent } from "react";
import { ClientResponseError } from "pocketbase";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useWorkspace } from "../workspace-context";
import { CircleModal, FormError } from "./circle-dialogs";
import { circlesApi, type CircleExpense } from "@/lib/circles";
import { categoryLabel, errorMessage, money } from "@/lib/domain";

export function MoveToPersonalDialog({ circle, expense, onClose, onMoved, onRefresh }: {
    circle: string;
    expense: CircleExpense;
    onClose: () => void;
    onMoved: () => void;
    onRefresh: () => void;
}) {
    const { categories } = useWorkspace();
    const activeCategories = categories.filter((item) => item.active);
    const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
    const exact = activeCategories.find((item) => item.name === categoryLabel(expense));
    const matches = activeCategories.filter((item) => normalize(item.name) === normalize(categoryLabel(expense)));
    const matched = exact || (matches.length === 1 ? matches[0] : null) || activeCategories.find((item) => normalize(item.name) === "other") || activeCategories[0];
    const [category, setCategory] = useState(matched?.id || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [unconfirmed, setUnconfirmed] = useState(false);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!category || busy || unconfirmed) return;
        setBusy(true);
        setError("");
        try {
            await circlesApi.moveToPersonal(circle, expense, category);
            onMoved();
            onClose();
        } catch (failure) {
            if (failure instanceof ClientResponseError && (failure.status === 404 || failure.status === 0 || failure.status >= 500)) {
                setUnconfirmed(true);
                setError(failure.status === 404 ? "This transaction is no longer available in the Circle. It may already have moved. Check your personal ledger." : "Could not confirm the move. Check your personal ledger before trying again.");
                onRefresh();
            } else setError(errorMessage(failure));
        } finally {
            setBusy(false);
        }
    }

    return (
        <CircleModal title={`Move ${expense.kind} to personal`} description={`${expense.title} · ${money(expense.amount, expense.currency)} ${expense.currency}`} busy={busy} onClose={onClose}>
            <form onSubmit={submit} className="space-y-5 pt-2">
                <div>
                    <label htmlFor="personal-move-category" className="field-label">Personal category</label>
                    <Select value={category} onValueChange={setCategory} disabled={busy || unconfirmed}>
                        <SelectTrigger id="personal-move-category" className="h-11! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{activeCategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <p className="text-xs leading-6 text-muted-foreground">The full {expense.kind} amount moves to your personal ledger. The Circle split is removed and member balances are recalculated. Recorded repayments stay in place.</p>
                {expense.recurrence && <p className="text-xs leading-6 text-muted-foreground">The recurring schedule moves too. Earlier occurrences stay in the Circle.</p>}
                <FormError error={error} />
                <DialogFooter>
                    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>{unconfirmed ? "Close" : "Cancel"}</Button>
                    <Button type="submit" disabled={busy || unconfirmed || !category}>{busy && <Loader2 className="animate-spin" />}Move to personal</Button>
                </DialogFooter>
            </form>
        </CircleModal>
    );
}
