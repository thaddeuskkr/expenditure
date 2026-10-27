"use client";

import { useState, type FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { RecurrenceControl } from "../recurrence-control";
import { Checkbox } from "../ui/checkbox";
import { DateTimePicker } from "../date-time-picker";
import { DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { UserAvatar } from "../user-avatar";
import { useWorkspace } from "../workspace-context";
import {
    currencyDigits,
    type Recurrence,
    errorMessage,
    formatAmountInput,
    fromZonedInput,
    money,
    parseMinorUnits,
    zonedInput,
} from "@/lib/domain";
import {
    circleCore,
    circlesApi,
    type CircleDetail,
    type CircleExpense,
    type CircleShare,
    type SplitMode,
} from "@/lib/circles";
import { CircleModal, CurrencySelect, FormError, SaveButton } from "./circle-dialogs";

export function CircleExpenseEditor({
    data,
    expense,
    kind = "expense",
    onClose,
    onSaved,
}: {
    data: CircleDetail;
    expense: CircleExpense | null;
    kind?: "expense" | "income";
    onClose: () => void;
    onSaved: () => void;
}) {
    const { preferences } = useWorkspace();
    const entryKind = expense?.kind || kind;
    const categories = data.categories.filter((item) => item.active || item.name === expense?.category);
    const [category, setCategory] = useState(expense?.category || categories.find((item) => item.name === "Other")?.name || categories[0]?.name || "");
    const [recurrence, setRecurrence] = useState<Recurrence>(expense?.recurrence || "");
    const eligible = data.members.filter(
        (member) =>
            member.active ||
            expense?.shares.some((share) => share.member === member.id) ||
            expense?.paid_by === member.id,
    );
    const [code, setCode] = useState(expense?.currency || data.circle.currency);
    const [amount, setAmount] = useState(
        expense ? formatAmountInput(expense.amount, expense.currency) : "",
    );
    const [payer, setPayer] = useState(expense?.paid_by || data.me);
    const [mode, setMode] = useState<SplitMode>(expense?.split_mode || "even");
    const [selected, setSelected] = useState(
        expense?.shares.map((share) => share.member) ||
        eligible.filter((m) => m.active).map((m) => m.id),
    );
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            (expense?.shares || []).map((share) => [
                share.member,
                expense?.split_mode === "percentage" ?
                        ((share.percentage_bp || 0) / 100).toFixed(2) :
                        formatAmountInput(share.amount, expense!.currency),
            ]),
        ),
    );
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    let preview: CircleShare[] = [],
        splitError = "";
    function splitInputs() {
        return selected.map((member) => ({
            member,
            ...(mode === "percentage" ?
                    { percentage_bp: circleCore.parseDecimal(values[member] || "0", 2) } :
                mode === "exact" ? { amount: circleCore.parseDecimal(values[member] || "0", currencyDigits(code)) } : {}),
        }));
    }

    try {
        preview = circleCore.allocate(
            parseMinorUnits(amount, code),
            mode,
            splitInputs(),
        );
    } catch (e) {
        splitError = errorMessage(e);
    }

    function changeMode(next: SplitMode) {
        setMode(next);
        if (next === "percentage" && selected.length) {
            setValues(
                Object.fromEntries(
                    circleCore
                        .allocate(
                            10000,
                            "even",
                            selected.map((member) => ({ member })),
                        )
                        .map((share) => [share.member, (share.amount / 100).toFixed(2)]),
                ),
            );
        } else if (next === "exact" && preview.length) {
            setValues(
                Object.fromEntries(
                    preview.map((share) => [
                        share.member,
                        formatAmountInput(share.amount, code),
                    ]),
                ),
            );
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (splitError) {
            setError(splitError);
            return;
        }

        setBusy(true);
        const form = new FormData(event.currentTarget);
        try {
            await circlesApi.saveExpense(
                data.circle.id,
                {
                    kind: entryKind,
                    recurrence: entryKind === "expense" ? recurrence : "",
                    title: String(form.get("title")).trim(),
                    category,
                    amount: parseMinorUnits(amount, code),
                    currency: code,
                    paid_by: payer,
                    split_mode: mode,
                    shares: splitInputs(),
                    payment_method: String(form.get("payment_method") || ""),
                    notes: String(form.get("notes") || ""),
                    occurred_at: fromZonedInput(
                        String(form.get("occurred_at")),
                        preferences.timezone,
                    ),
                    ...(expense ? { version: expense.version } : {}),
                },
                expense?.id,
            );
            onSaved();
            onClose();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <CircleModal
            title={`${expense ? "Edit" : "Add"} shared ${entryKind}`}
            description={data.circle.name}
            onClose={onClose}
            busy={busy}
            wide>
            <form onSubmit={submit} className="space-y-6 pt-2">
                <div>
                    <label htmlFor="shared-title" className="field-label">
                        {entryKind === "income" ? "Income" : "Expense"}
                    </label>
                    <Input
                        id="shared-title"
                        name="title"
                        defaultValue={expense?.title}
                        maxLength={160}
                        required
                        autoFocus
                        placeholder={entryKind === "income" ? "e.g. Group refund" : "e.g. Dinner"}
                        className="h-10"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="shared-amount" className="field-label">
                            Amount
                        </label>
                        <Input
                            id="shared-amount"
                            name="amount"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={formatAmountInput(0, code)}
                            required
                            className="h-10"
                        />
                    </div>
                    <div>
                        <label htmlFor="shared-currency" className="field-label">
                            Currency
                        </label>
                        <CurrencySelect id="shared-currency" value={code} onChange={setCode} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label htmlFor="shared-payer" className="field-label">
                            {entryKind === "income" ? "Received by" : "Paid by"}
                        </label>
                        <Select value={payer} onValueChange={setPayer}>
                            <SelectTrigger id="shared-payer" className="h-10! w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {eligible.map((member) => (
                                    <SelectItem key={member.id} value={member.id}>
                                        {member.name}
                                        {member.id === data.me ? " (you)" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label htmlFor="shared-date" className="field-label">
                            Date & time
                        </label>
                        <DateTimePicker
                            id="shared-date"
                            name="occurred_at"
                            defaultValue={zonedInput(
                                expense?.occurred_at || new Date(),
                                preferences.timezone,
                            )}
                            timezone={preferences.timezone}
                            className="h-10"
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="shared-category" className="field-label">Category</label>
                    <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger id="shared-category" className="h-10! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{categories.map((item) => <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <fieldset className="border-t pt-5">
                    <legend className="field-label pt-5">Split between</legend>
                    <div className="mb-5 flex gap-1 rounded-lg border p-1">
                        {(
                            [
                                ["even", "Equal"],
                                ["percentage", "Percentage"],
                                ["exact", "Exact amounts"],
                            ] as const
                        ).map(([value, label]) => (
                            <Button
                                key={value}
                                type="button"
                                variant={mode === value ? "secondary" : "ghost"}
                                className="min-w-0 flex-1 px-2 text-xs"
                                aria-pressed={mode === value}
                                onClick={() => changeMode(value)}>
                                {label}
                            </Button>
                        ))}
                    </div>
                    <div className="mb-2 flex justify-end">
                        <button
                            type="button"
                            className="text-[11px] text-primary"
                            onClick={() =>
                                setSelected(eligible.filter((m) => m.active).map((m) => m.id))}>
                            Select all active members
                        </button>
                    </div>
                    <div className="divide-y rounded-lg border px-4">
                        {eligible.map((member) => {
                            const checked = selected.includes(member.id),
                                share = preview.find((part) => part.member === member.id);
                            return (
                                <div key={member.id} className="flex items-center gap-3 py-3">
                                    <label className="flex min-w-0 flex-1 items-center gap-3">
                                        <Checkbox
                                            checked={checked}
                                            onCheckedChange={(next) =>
                                                setSelected((previous) =>
                                                    next === true ?
                                                            [...previous, member.id] :
                                                            previous.filter((id) => id !== member.id),
                                                )}
                                        />
                                        {member.expand.user && (
                                            <UserAvatar user={member.expand.user} name={member.name} />
                                        )}
                                        <span className="min-w-0 truncate text-xs">
                                            {member.name}
                                            {member.id === data.me ? " (you)" : ""}
                                            {!member.active ? " · former" : ""}
                                        </span>
                                    </label>
                                    {checked && mode !== "even" && (
                                        <div className="flex w-28 items-center gap-2">
                                            <Input
                                                aria-label={`${member.name} ${mode === "percentage" ? "percentage" : "exact amount"}`}
                                                value={values[member.id] || ""}
                                                onChange={(e) =>
                                                    setValues((previous) => ({
                                                        ...previous,
                                                        [member.id]: e.target.value,
                                                    }))}
                                                inputMode="decimal"
                                                placeholder="0"
                                                className="h-9 text-right"
                                            />
                                            {mode === "percentage" && (
                                                <span className="text-xs text-muted-foreground">
                                                    %
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {checked && mode === "even" && (
                                        <span className="text-xs tabular-nums text-muted-foreground">
                                            {share ? money(share.amount, code) : "—"}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {amount && (
                        <p
                            className={`mt-3 text-[11px] leading-5 ${splitError ? "text-destructive" : "text-muted-foreground"}`}
                            aria-live="polite">
                            {splitError ||
                                `${selected.length} participant${selected.length === 1 ? "" : "s"} · ${money(
                                    preview.reduce((sum, share) => sum + share.amount, 0),
                                    code,
                                )} allocated${mode === "even" ? "; rounding is distributed automatically." : "."}`}
                        </p>
                    )}
                </fieldset>
                <div>
                    <label htmlFor="shared-payment" className="field-label">
                        Payment method{" "}
                        <span className="normal-case text-muted-foreground">(optional)</span>
                    </label>
                    <Input
                        id="shared-payment"
                        name="payment_method"
                        defaultValue={expense?.payment_method}
                        maxLength={80}
                        placeholder="e.g. Visa"
                        className="h-10"
                    />
                </div>
                <div>
                    <label htmlFor="shared-notes" className="field-label">
                        Notes <span className="normal-case text-muted-foreground">(optional)</span>
                    </label>
                    <textarea
                        id="shared-notes"
                        name="notes"
                        defaultValue={expense?.notes}
                        maxLength={2000}
                        rows={2}
                        className="w-full appearance-none rounded-lg border bg-transparent p-3 text-base outline-none focus:border-ring md:text-xs"
                    />
                </div>
                {entryKind === "expense" && <RecurrenceControl value={recurrence} onChange={setRecurrence} next={recurrence === expense?.recurrence ? expense?.recurrence_next : undefined} timezone={expense?.recurrence_timezone || preferences.timezone} error={expense?.recurrence_error} />}
                <FormError error={error} />
                <DialogFooter>
                    <SaveButton busy={busy} label={expense ? "Save changes" : `Add ${entryKind}`} />
                </DialogFooter>
            </form>
        </CircleModal>
    );
}
