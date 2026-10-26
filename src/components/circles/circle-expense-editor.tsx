"use client";

import { useState, type FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { UserAvatar } from "../user-avatar";
import { useWorkspace } from "../workspace-context";
import {
    currencyDigits,
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
    onClose,
    onSaved,
}: {
    data: CircleDetail;
    expense: CircleExpense | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { preferences } = useWorkspace();
    const eligible = data.members.filter(
        (member) =>
            member.active ||
            expense?.shares.some((share) => share.member === member.id) ||
            expense?.paid_by === member.id,
    );
    const [code, setCode] = useState(expense?.currency || data.circle.currency);
    const [amount, setAmount] = useState(
        expense ? formatAmountInput(expense.amount_minor, expense.currency) : "",
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
                        formatAmountInput(share.amount_minor, expense!.currency),
            ]),
        ),
    );
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    let preview: CircleShare[] = [],
        splitError = "";
    try {
        preview = circleCore.allocate(
            parseMinorUnits(amount, code),
            mode,
            selected.map((member) => ({ member, value: values[member] || "0" })),
            currencyDigits(code),
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
                            2,
                        )
                        .map((share) => [share.member, (share.amount_minor / 100).toFixed(2)]),
                ),
            );
        } else if (next === "exact" && preview.length) {
            setValues(
                Object.fromEntries(
                    preview.map((share) => [
                        share.member,
                        formatAmountInput(share.amount_minor, code),
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
                    title: String(form.get("title")).trim(),
                    amount_minor: parseMinorUnits(amount, code),
                    currency: code,
                    paid_by: payer,
                    split_mode: mode,
                    shares: selected.map((member) => ({
                        member,
                        ...(mode === "even" ? {} : { value: values[member] || "0" }),
                    })),
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
            title={expense ? "Edit shared expense" : "Add shared expense"}
            description={data.circle.name}
            onClose={onClose}
            busy={busy}
            wide>
            <form onSubmit={submit} className="space-y-6 pt-2">
                <div>
                    <label htmlFor="shared-title" className="field-label">
                        Expense
                    </label>
                    <Input
                        id="shared-title"
                        name="title"
                        defaultValue={expense?.title}
                        maxLength={160}
                        required
                        autoFocus
                        placeholder="e.g. Dinner"
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
                            Paid by
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
                        <Input
                            id="shared-date"
                            name="occurred_at"
                            type="datetime-local"
                            defaultValue={zonedInput(
                                expense?.occurred_at || new Date(),
                                preferences.timezone,
                            )}
                            required
                            className="h-10"
                        />
                    </div>
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
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) =>
                                                setSelected((previous) =>
                                                    e.target.checked ?
                                                            [...previous, member.id] :
                                                            previous.filter((id) => id !== member.id),
                                                )}
                                            className="size-4 accent-primary"
                                        />
                                        {member.user && (
                                            <UserAvatar user={member.user} name={member.name} />
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
                                            {share ? money(share.amount_minor, code) : "—"}
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
                                    preview.reduce((sum, share) => sum + share.amount_minor, 0),
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
                        className="w-full rounded-lg border bg-transparent p-3 text-xs outline-none focus:border-ring"
                    />
                </div>
                <FormError error={error} />
                <DialogFooter>
                    <SaveButton busy={busy} label={expense ? "Save expense" : "Add expense"} />
                </DialogFooter>
            </form>
        </CircleModal>
    );
}
