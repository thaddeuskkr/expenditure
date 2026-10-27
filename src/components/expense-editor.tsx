"use client";
import { useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { CurrencyPicker } from "./currency-picker";
import { DateTimePicker } from "./date-time-picker";
import { useWorkspace } from "./workspace-context";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import {
    errorMessage,
    fromZonedInput,
    parseMinorUnits,
    formatAmountInput,
    convertAmount,
    money,
    rateDate,
    zonedInput,
    type Category,
    type Expense,
    type ExpenseInput,
} from "@/lib/domain";

export function ExpenseEditor({
    expense,
    currency,
    timezone,
    onClose,
    onSave,
}: {
    expense: Expense | null;
    currency: string;
    timezone: string;
    onClose: () => void;
    onSave: (data: ExpenseInput, id?: string) => Promise<void>;
}) {
    const { categories, preferences } = useWorkspace();
    const categoryNames = categories
        .filter((c) => c.active || c.name === expense?.category)
        .map((c) => c.name);
    const defaultCategory = categoryNames.includes("Other") ?
        "Other" :
        categoryNames[0];
    const currencies = Array.from(
        new Set([
            ...preferences.currencies,
            ...(expense ? [expense.currency] : []),
        ]),
    );
    const [amount, setAmount] = useState(
        expense ? formatAmountInput(expense.amount_cents, expense.currency) : "",
    );
    const [category, setCategory] = useState<Category>(
        expense?.category || defaultCategory,
    );
    const [selectedCurrency, setCurrency] = useState(
        expense?.currency || currency,
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setBusy(true);
        const form = new FormData(event.currentTarget);
        try {
            await onSave(
                {
                    merchant: String(form.get("merchant")).trim(),
                    amount_cents: parseMinorUnits(
                        String(form.get("amount")),
                        selectedCurrency,
                    ),
                    currency: selectedCurrency,
                    category,
                    occurred_at: fromZonedInput(
                        String(form.get("occurred_at")),
                        timezone,
                    ),
                    card: String(form.get("card") || "").trim(),
                    notes: String(form.get("notes") || "").trim(),
                },
                expense?.id,
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
            <DialogContent className="sm:max-w-115">
                <DialogHeader>
                    <DialogTitle className="font-display text-3xl font-normal">
                        {expense ? "Edit expense" : "Add expense"}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Enter expense details.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="mt-3 space-y-5">
                    <div>
                        <label className="field-label" htmlFor="merchant">
                            Merchant
                        </label>
                        <Input
                            id="merchant"
                            name="merchant"
                            placeholder="Where did you spend?"
                            defaultValue={expense?.merchant}
                            maxLength={160}
                            required
                            autoFocus
                            className="h-11"
                        />
                    </div>
                    <div className="grid grid-cols-[1fr_105px] gap-3">
                        <div>
                            <label className="field-label" htmlFor="amount">
                                Amount
                            </label>
                            <Input
                                id="amount"
                                name="amount"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                                className="h-11 text-lg"
                            />
                        </div>
                        <div>
                            <label className="field-label" htmlFor="expense-currency">
                                Currency
                            </label>
                            <CurrencyPicker id="expense-currency" value={selectedCurrency} onChange={setCurrency} codes={currencies} compact className="h-11" />
                        </div>
                    </div>
                    {selectedCurrency !== preferences.currency && amount && (
                        <ConversionPreview amount={amount} currency={selectedCurrency} />
                    )}
                    <div>
                        <label className="field-label" htmlFor="expense-category">
                            Category
                        </label>
                        <Select
                            value={category}
                            onValueChange={(c) => setCategory(c as Category)}>
                            <SelectTrigger id="expense-category" className="h-11! w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {categoryNames.map((c) => (
                                    <SelectItem key={c} value={c}>
                                        {c}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="field-label" htmlFor="occurred_at">
                            Date & time{" "}
                            <span className="font-normal text-muted-foreground">
                                · {timezone.replaceAll("_", " ")}
                            </span>
                        </label>
                        <DateTimePicker
                            id="occurred_at"
                            name="occurred_at"
                            defaultValue={zonedInput(
                                expense?.occurred_at || new Date(),
                                timezone,
                            )}
                            timezone={timezone}
                            className="h-11"
                        />
                    </div>
                    <div>
                        <label className="field-label" htmlFor="card">
                            Payment method{" "}
                            <span className="font-normal text-muted-foreground">
                                (optional)
                            </span>
                        </label>
                        <Input
                            id="card"
                            name="card"
                            placeholder="e.g. DBS Live Fresh, cash"
                            maxLength={80}
                            defaultValue={expense?.card}
                            className="h-11"
                        />
                    </div>
                    <div>
                        <label className="field-label" htmlFor="notes">
                            Notes{" "}
                            <span className="font-normal text-muted-foreground">
                                (optional)
                            </span>
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            maxLength={2000}
                            defaultValue={expense?.notes}
                            rows={2}
                            placeholder="Anything to remember?"
                            className="w-full resize-none appearance-none rounded-lg border bg-input/20 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring/40 md:text-sm"
                        />
                    </div>
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="submit" className="h-10 px-5" disabled={busy}>
                            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                            {expense ? "Save changes" : "Add expense"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ConversionPreview({
    amount,
    currency,
}: {
    amount: string;
    currency: string;
}) {
    const { rates, preferences } = useWorkspace();
    let minor: number;
    try {
        minor = parseMinorUnits(amount, currency);
    } catch {
        return null;
    }

    const converted = convertAmount(minor, currency, preferences.currency, rates);
    return (
        <p className="text-xs text-muted-foreground">
            {converted === null ?
                "Conversion unavailable" :
                `≈ ${money(converted, preferences.currency)} ${preferences.currency}`}
            <span className="mt-1 block text-[10px]">
                {rateDate(currency, preferences.currency, rates) ?
                    `Reference rate dated ${rateDate(currency, preferences.currency, rates)}` :
                    "No usable reference rate cached."}
            </span>
        </p>
    );
}
