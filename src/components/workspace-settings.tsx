"use client";
import { useMemo, useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { Switch } from "radix-ui";
import { Button } from "./ui/button";
import { CurrencyPicker, EnabledCurrenciesPicker } from "./currency-picker";
import { SearchableSelect } from "./ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CategorySettings } from "./category-settings";
import { RecurringTransactions } from "./recurring-transactions";
import { useWorkspace } from "./workspace-context";
import {
    DEFAULT_TABS,
    type Expense,
    TIMEZONES,
    errorMessage,
    dateTimeLabel,
    timezoneLabel,
    type Preferences,
} from "@/lib/domain";

export function WorkspaceSettings({
    onSave,
    onCategoriesChanged,
    onEditRecurring,
    recurringRevision,
}: {
    onEditRecurring: (expense: Expense) => void;
    recurringRevision: number;
    onSave: (
        data: Pick<Preferences, "currency" | "timezone" | "currencies" | "default_tab" | "time_format" | "show_circle_transactions">,
    ) => Promise<void>;
    onCategoriesChanged: () => Promise<void>;
}) {
    const { preferences, categories, rates } = useWorkspace();
    const [defaultTab, setDefaultTab] = useState(preferences.default_tab);
    const [main, setMain] = useState(preferences.currency);
    const [timezone, setTimezone] = useState(preferences.timezone);
    const [timeFormat, setTimeFormat] = useState(preferences.time_format);
    const [showCircleTransactions, setShowCircleTransactions] = useState(preferences.show_circle_transactions);
    const [enabled, setEnabled] = useState(preferences.currencies);
    const [timezoneDate, setTimezoneDate] = useState(() => new Date());
    const timezoneOptions = useMemo(() => {
        return TIMEZONES.map((zone) => ({ value: zone, label: timezoneLabel(zone, timezoneDate) }));
    }, [timezoneDate]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            await onSave({ currency: main, timezone, currencies: enabled, default_tab: defaultTab, time_format: timeFormat, show_circle_transactions: showCircleTransactions });
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="max-w-3xl space-y-12 animate-enter">
            <form onSubmit={save} className="space-y-6">
                <h2 className="border-b pb-4 text-sm font-medium">
                    Preferences
                </h2>
                <div>
                    <label className="field-label" htmlFor="default-tab">Default tab on login</label>
                    <SearchableSelect id="default-tab" value={defaultTab} onValueChange={(value) => setDefaultTab(value as Preferences["default_tab"])} options={DEFAULT_TABS.map((value) => ({ value, label: value }))} searchPlaceholder="Find a tab…" />
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                        <label className="field-label" htmlFor="main-currency">
                            Main currency
                        </label>
                        <CurrencyPicker id="main-currency" value={main} onChange={setMain} codes={enabled} />
                        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                            Used for converted amounts, combined totals, and new budgets.
                        </p>
                    </div>
                    <div>
                        <label className="field-label" htmlFor="preference-timezone">
                            Timezone
                        </label>
                        <SearchableSelect
                            id="preference-timezone"
                            value={timezone}
                            onValueChange={setTimezone}
                            onOpenChange={(open) => {
                                if (open) setTimezoneDate(new Date());
                            }}
                            options={timezoneOptions}
                            searchPlaceholder="Search timezones or GMT offsets…"
                        />
                    </div>
                </div>
                <div>
                    <label className="field-label" htmlFor="time-format">Time format</label>
                    <Select value={timeFormat} onValueChange={(value) => setTimeFormat(value as Preferences["time_format"])}>
                        <SelectTrigger id="time-format" className="h-10! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">24-hour (13:00)</SelectItem>
                            <SelectItem value="12h">12-hour (1:00 PM)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between gap-5 border-y py-5">
                    <div>
                        <label htmlFor="show-circle-transactions" className="text-sm">Show Circle transactions</label>
                        <p id="circle-transactions-description" className="mt-2 text-[11px] leading-5 text-muted-foreground">Include your allocated Circle shares alongside personal transactions. Budget totals are unchanged.</p>
                    </div>
                    <Switch.Root id="show-circle-transactions" checked={showCircleTransactions} onCheckedChange={setShowCircleTransactions} aria-describedby="circle-transactions-description" className="flex h-6 w-11 shrink-0 items-center rounded-full bg-muted p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary">
                        <Switch.Thumb className="block size-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                </div>
                <div>
                    <label className="field-label" htmlFor="enabled-currencies">Enabled currencies</label>
                    <EnabledCurrenciesPicker value={enabled} main={main} onChange={setEnabled} />
                </div>
                <p className="text-[11px] leading-5 text-muted-foreground">
                    Disabling a currency hides it from new expense forms. Existing
                    expenses keep their original amounts.
                </p>
                {error && (
                    <p role="alert" className="text-xs text-destructive">
                        {error}
                    </p>
                )}
                <Button type="submit" disabled={busy} className="h-10 px-5">
                    {busy ? <Loader2 className="animate-spin" /> : <Check />}Save
                    preferences
                </Button>
            </form>
            <RecurringTransactions key={recurringRevision} onEdit={onEditRecurring} />
            <CategorySettings categories={categories} onCategoriesChanged={onCategoriesChanged} />
            <section className="border-t pt-6">
                <h2 className="text-sm font-medium">Exchange rates</h2>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    Reference rates from{" "}
                    <a
                        href={rates.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline">
                        {rates.provider}
                    </a>
                    . Checked automatically every hour; the source usually publishes
                    daily. Conversions use the latest available rates, including for past
                    expenses.
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                    {rates.fetched_at ?
                        `Last fetched: ${dateTimeLabel(rates.fetched_at, timezone, timeFormat)}` :
                        "No rates cached yet."}
                </p>
            </section>
        </div>
    );
}
