"use client";

import { useState, type FormEvent } from "react";
import { Input } from "../ui/input";
import { DateTimePicker } from "../date-time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DialogFooter } from "../ui/dialog";
import { useWorkspace } from "../workspace-context";
import {
    asDate,
    errorMessage,
    formatAmountInput,
    fromZonedInput,
    money,
    parseMinorUnits,
    zonedInput,
} from "@/lib/domain";
import { circlesApi, type CircleDetail, type CircleSettlement, type SettlementSuggestion } from "@/lib/circles";
import { CircleModal, CurrencySelect, FormError, SaveButton } from "./circle-dialogs";

export function SettlementDialog({
    data,
    suggestion,
    settlement,
    onClose,
    onSaved,
}: {
    data: CircleDetail;
    suggestion: SettlementSuggestion;
    settlement?: CircleSettlement;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { preferences } = useWorkspace();
    const [currency, setCurrency] = useState(suggestion.currency),
        [from, setFrom] = useState(suggestion.from_member),
        [to, setTo] = useState(suggestion.to_member);
    const [amount, setAmount] = useState(
        formatAmountInput(suggestion.amount, suggestion.currency),
    );
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    const net = (id: string) => {
        const current = data.balances.find((row) => row.member === id && row.currency === currency)?.net || 0;
        if (!settlement || settlement.currency !== currency) return current;
        if (id === settlement.from_member) return current - settlement.amount;
        if (id === settlement.to_member) return current + settlement.amount;
        return current;
    };

    const maximum = Math.max(0, Math.min(-net(from), net(to)));
    const currencies = [...new Set([...data.suggestions.map((row) => row.currency), ...(settlement ? [settlement.currency] : [])])];
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        const selectedDate = String(form.get("occurred_at"));
        try {
            await circlesApi.settle(data.circle.id, {
                from_member: from,
                to_member: to,
                currency,
                amount: parseMinorUnits(amount, currency),
                notes: String(form.get("notes") || ""),
                occurred_at: settlement && selectedDate === zonedInput(settlement.occurred_at, preferences.timezone) ?
                        asDate(settlement.occurred_at).toISOString() :
                        fromZonedInput(selectedDate, preferences.timezone),
            }, settlement);
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
            title={settlement ? "Edit repayment" : "Record settlement"}
            description={`${settlement ? "Update" : "Record"} a repayment made outside Expenditure. This does not transfer money.`}
            busy={busy}
            onClose={onClose}>
            <form onSubmit={submit} className="space-y-5 pt-3">
                <div>
                    <label htmlFor="settlement-currency" className="field-label">
                        Currency
                    </label>
                    <CurrencySelect
                        id="settlement-currency"
                        value={currency}
                        codes={currencies}
                        onChange={(code) => {
                            setCurrency(code);
                            const next = settlement?.currency === code ? settlement : data.suggestions.find((row) => row.currency === code);
                            if (!next) return;
                            setFrom(next.from_member);
                            setTo(next.to_member);
                            setAmount(formatAmountInput(next.amount, code));
                        }}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {(
                        [
                            ["From", from, setFrom, -1],
                            ["To", to, setTo, 1],
                        ] as const
                    ).map(([label, value, setter, sign]) => (
                        <div key={label}>
                            <label htmlFor={`settlement-${label}`} className="field-label">
                                {label}
                            </label>
                            <Select value={value} onValueChange={setter}>
                                <SelectTrigger id={`settlement-${label}`} className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {data.members
                                        .filter((m) => net(m.id) * sign > 0 || (settlement && m.id === value))
                                        .map((member) => (
                                            <SelectItem key={member.id} value={member.id}>
                                                {member.name}
                                                {member.id === data.me ? " (you)" : ""}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ))}
                </div>
                <div>
                    <label htmlFor="settlement-amount" className="field-label">
                        Amount ({currency})
                    </label>
                    <Input
                        id="settlement-amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        inputMode="decimal"
                        required
                        autoFocus
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                        {settlement ? "Maximum" : "Remaining"}: {money(maximum, currency)} {currency}
                    </p>
                </div>
                <div>
                    <label htmlFor="settlement-date" className="field-label">
                        Date & time
                    </label>
                    <DateTimePicker
                        id="settlement-date"
                        name="occurred_at"
                        defaultValue={zonedInput(settlement?.occurred_at || new Date(), preferences.timezone)}
                        timezone={preferences.timezone}
                    />
                </div>
                <div>
                    <label htmlFor="settlement-notes" className="field-label">
                        Notes (optional)
                    </label>
                    <Input id="settlement-notes" name="notes" defaultValue={settlement?.notes} maxLength={1000} />
                </div>
                <FormError error={error} />
                <DialogFooter>
                    <SaveButton busy={busy} label={settlement ? "Save changes" : "Record settlement"} />
                </DialogFooter>
            </form>
        </CircleModal>
    );
}
