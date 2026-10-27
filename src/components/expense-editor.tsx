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
import { RecurrenceControl } from "./recurrence-control";
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
    type Recurrence,
    type Expense,
    type ExpenseInput,
} from "@/lib/domain";

export function ExpenseEditor({
    expense,
    kind = "expense",
    currency,
    timezone,
    onClose,
    onSave,
    onMove,
}: {
    expense: Expense | null;
    kind?: "expense" | "income";
    currency: string;
    timezone: string;
    onMove?: (expense: Expense) => void;
    onClose: () => void;
    onSave: (data: ExpenseInput, id?: string) => Promise<void>;
}) {
    const { categories, preferences } = useWorkspace();
    const entryKind = expense?.kind || kind;
    const [recurrence, setRecurrence] = useState<Recurrence>(expense?.recurrence || "");
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
        expense ? formatAmountInput(expense.amount, expense.currency) : "",
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
                    kind: entryKind,
                    recurrence: entryKind === "expense" ? recurrence : "",
                    merchant: String(form.get("merchant")).trim(),
                    amount: parseMinorUnits(
                        String(form.get("amount")),
                        selectedCurrency,
                    ),
                    currency: selectedCurrency,
                    category,
                    occurred_at: fromZonedInput(
                        String(form.get("occurred_at")),
                        timezone,
                    ),
                    payment_method: String(form.get("payment_method") || "").trim(),
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
                        {`${expense ? "Edit" : "Add"} ${entryKind}`}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Enter transaction details.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="mt-3 space-y-5">
                    <div>
                        <label className="field-label" htmlFor="merchant">
                            {entryKind === "income" ? "Source" : "Merchant"}
                        </label>
                        <Input
                            id="merchant"
                            name="merchant"
                            placeholder={entryKind === "income" ? "Where did it come from?" : "Where did you spend?"}
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
                        <label className="field-label" htmlFor="payment_method">
                            Payment method{" "}
                            <span className="font-normal text-muted-foreground">
                                (optional)
                            </span>
                        </label>
                        <Input
                            id="payment_method"
                            name="payment_method"
                            placeholder="e.g. DBS Live Fresh, cash"
                            maxLength={80}
                            defaultValue={expense?.payment_method}
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
                    {entryKind === "expense" && <RecurrenceControl value={recurrence} onChange={setRecurrence} next={recurrence === expense?.recurrence ? expense?.recurrence_next : undefined} timezone={expense?.recurrence_timezone || timezone} error={expense?.recurrence_error} />}
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        {expense && entryKind === "expense" && onMove && <Button type="button" variant="outline" disabled={busy} onClick={() => onMove(expense)}>Move to Circle</Button>}
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="submit" className="h-10 px-5" disabled={busy}>
                            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
                            {expense ? "Save changes" : `Add ${entryKind}`}
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
