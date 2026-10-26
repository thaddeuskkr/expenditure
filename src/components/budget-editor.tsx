"use client";

import { useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { useWorkspace } from "./workspace-context";
import {
    formatAmountInput,
    errorMessage,
    monthTitle,
    parseMinorUnits,
    type Budget,
} from "@/lib/domain";

export function BudgetEditor({
    budget,
    month,
    currency,
    onClose,
    onSave,
    onDelete,
}: {
    budget: Budget | null;
    month: string;
    currency: string;
    onClose: () => void;
    onSave: (
        data: { category: string; amount_cents: number },
        existing?: Budget,
    ) => Promise<void>;
    onDelete: (budget: Budget) => Promise<void>;
}) {
    const { categories } = useWorkspace();
    const categoryNames = categories
        .filter((c) => c.active || c.name === budget?.category)
        .map((c) => c.name);
    const [category, setCategory] = useState<string>(
        budget?.category || "Overall",
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        try {
            await onSave(
                {
                    category,
                    amount_cents: parseMinorUnits(String(form.get("amount")), currency),
                },
                budget || undefined,
            );
            onClose();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !busy) onClose();
            }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-display text-3xl font-normal">
                        {budget ? "Edit budget" : "Add budget"}
                    </DialogTitle>
                    <DialogDescription>
                        {monthTitle(month)} · {currency}
                    </DialogDescription>
                </DialogHeader>
                <form className="space-y-5 pt-3" onSubmit={submit}>
                    <div>
                        <label className="field-label" htmlFor="budget-category">
                            Category
                        </label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger id="budget-category" className="h-11! w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Overall">
                                    Overall monthly spending
                                </SelectItem>
                                {categoryNames.map((c) => (
                                    <SelectItem key={c} value={c}>
                                        {c}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="field-label" htmlFor="budget-amount">
                            Monthly limit ({currency})
                        </label>
                        <Input
                            id="budget-amount"
                            name="amount"
                            inputMode="decimal"
                            required
                            placeholder="0.00"
                            defaultValue={
                                budget ? formatAmountInput(budget.amount_cents, currency) : ""
                            }
                            autoFocus
                            className="h-11"
                        />
                    </div>
                    {error && (
                        <p role="alert" className="text-xs text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        {budget && (
                            <Button
                                type="button"
                                variant="ghost"
                                className="mr-auto text-destructive"
                                disabled={busy}
                                onClick={async () => {
                                    setBusy(true);
                                    try {
                                        await onDelete(budget);
                                        onClose();
                                    } catch (e) {
                                        setError(errorMessage(e));
                                    } finally {
                                        setBusy(false);
                                    }
                                }}>
                                Remove budget
                            </Button>
                        )}
                        <Button disabled={busy} type="submit" className="h-10 px-5">
                            {busy ? <Loader2 className="animate-spin" /> : <Check />}Save
                            budget
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
