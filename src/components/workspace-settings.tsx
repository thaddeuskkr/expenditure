"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { Switch, Tabs } from "radix-ui";
import { Button } from "./ui/button";
import { CurrencyPicker, EnabledCurrenciesPicker } from "./currency-picker";
import { SearchableSelect } from "./ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CategorySettings } from "./category-settings";
import { RecurringTransactions } from "./recurring-transactions";
import { useWorkspace } from "./workspace-context";
import { circlesApi, type Circle } from "@/lib/circles";
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
    onDirtyChange,
}: {
    onEditRecurring: (expense: Expense) => void;
    recurringRevision: number;
    onDirtyChange: (dirty: boolean) => void;
    onSave: (
        data: Pick<Preferences, "currency" | "timezone" | "currencies" | "default_tab" | "time_format" | "show_circle_transactions" | "include_circle_in_budgets" | "default_api_circle">,
    ) => Promise<void>;
    onCategoriesChanged: () => Promise<void>;
}) {
    const { preferences, categories, rates } = useWorkspace();
    const [tab, setTab] = useState("General");
    const [defaultTab, setDefaultTab] = useState(preferences.default_tab);
    const [defaultApiCircle, setDefaultApiCircle] = useState(preferences.default_api_circle);
    const [circles, setCircles] = useState<Circle[]>([]);
    const [circlesError, setCirclesError] = useState("");
    const [circlesLoaded, setCirclesLoaded] = useState(false);
    const [circlesRevision, setCirclesRevision] = useState(0);
    useEffect(() => {
        let active = true;
        circlesApi.list().then((index) => {
            if (active) {
                setCircles(index.circles);
                setCirclesLoaded(true);
                setCirclesError("");
            }
        }).catch((failure) => { if (active) setCirclesError(errorMessage(failure)); });
        return () => {
            active = false;
        };
    }, [circlesRevision]);
    const apiWorkspaceOptions = [
        { value: "personal", label: "Personal workspace" },
        ...circles.map((circle) => ({ value: circle.id, label: circle.name, description: "Circle" })),
        ...(defaultApiCircle && !circles.some((circle) => circle.id === defaultApiCircle) ? [{ value: defaultApiCircle, label: circlesLoaded ? "Unavailable Circle" : "Saved Circle", description: circlesLoaded ? "Choose another workspace to resume API imports" : "Loading workspace…" }] : []),
    ];
    const [main, setMain] = useState(preferences.currency);
    const [timezone, setTimezone] = useState(preferences.timezone);
    const [timeFormat, setTimeFormat] = useState(preferences.time_format);
    const [showCircleTransactions, setShowCircleTransactions] = useState(preferences.show_circle_transactions);
    const [includeCircleInBudgets, setIncludeCircleInBudgets] = useState(preferences.include_circle_in_budgets);
    const [enabled, setEnabled] = useState(preferences.currencies);
    const [timezoneDate, setTimezoneDate] = useState(() => new Date());
    const timezoneOptions = useMemo(() => {
        return TIMEZONES.map((zone) => ({ value: zone, label: timezoneLabel(zone, timezoneDate) }));
    }, [timezoneDate]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!dirty || busy) return;
        setBusy(true);
        setError("");
        try {
            await onSave({ currency: main, timezone, currencies: enabled, default_tab: defaultTab, time_format: timeFormat, show_circle_transactions: showCircleTransactions, include_circle_in_budgets: includeCircleInBudgets, default_api_circle: defaultApiCircle });
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    const changedTabs: Record<string, boolean> = {
        General: defaultTab !== preferences.default_tab || timezone !== preferences.timezone || timeFormat !== preferences.time_format,
        Transactions: showCircleTransactions !== preferences.show_circle_transactions || includeCircleInBudgets !== preferences.include_circle_in_budgets,
        Currencies: main !== preferences.currency || JSON.stringify(enabled) !== JSON.stringify(preferences.currencies),
        Categories: false,
        API: defaultApiCircle !== preferences.default_api_circle,
    };
    const dirty = Object.values(changedTabs).some(Boolean);
    useEffect(() => {
        onDirtyChange(dirty);
    }, [dirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);
    function discard() {
        setDefaultTab(preferences.default_tab);
        setTimezone(preferences.timezone);
        setTimeFormat(preferences.time_format);
        setShowCircleTransactions(preferences.show_circle_transactions);
        setIncludeCircleInBudgets(preferences.include_circle_in_budgets);
        setMain(preferences.currency);
        setEnabled(preferences.currencies);
        setDefaultApiCircle(preferences.default_api_circle);
        setError("");
    }

    return (
        <Tabs.Root value={tab} onValueChange={setTab} className="flex min-h-[calc(100svh-14rem)] max-w-3xl flex-col">
            <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <Tabs.List aria-label="Settings sections" className="flex w-max min-w-full gap-1">
                        {Object.keys(changedTabs).map((name) => (
                            <Tabs.Trigger key={name} value={name} aria-label={name} className="relative flex h-12 min-w-11 shrink-0 items-center justify-center border-b-2 border-transparent px-2 text-[11px] whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:bg-secondary data-[state=active]:border-primary data-[state=active]:text-foreground sm:px-4 sm:text-xs">
                                {name}
                                {changedTabs[name] && <span aria-hidden="true" className="absolute top-2 right-2 size-1 rounded-full bg-primary" />}
                            </Tabs.Trigger>
                        ))}
                    </Tabs.List>
                </div>
            </div>
            <div className="flex-1 pt-7 pb-8">
                <Tabs.Content value="General" className="space-y-6 outline-none data-[state=inactive]:hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
                    <h2 className="text-sm font-medium">General preferences</h2>
                    <fieldset disabled={busy} className="space-y-6">
                        <div>
                            <label className="field-label" htmlFor="default-tab">Default tab on login</label>
                            <SearchableSelect id="default-tab" value={defaultTab} onValueChange={(value) => setDefaultTab(value as Preferences["default_tab"])} options={DEFAULT_TABS.map((value) => ({ value, label: value }))} searchPlaceholder="Find a tab…" />
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
                    </fieldset>
                </Tabs.Content>
                <Tabs.Content value="Transactions" className="space-y-8 outline-none data-[state=inactive]:hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
                    <section className="space-y-5">
                        <h2 className="text-sm font-medium">Transaction preferences</h2>
                        <fieldset disabled={busy}>
                            <div className="divide-y border-y">
                                <div className="flex items-center justify-between gap-5 py-5">
                                    <div>
                                        <label htmlFor="include-circle-in-budgets" className="text-sm">Include Circle spending in budgets</label>
                                        <p id="circle-budgets-description" className="mt-2 text-[11px] leading-5 text-muted-foreground">Count your allocated Circle expense shares in personal budgets and spending summaries.</p>
                                    </div>
                                    <Switch.Root id="include-circle-in-budgets" checked={includeCircleInBudgets} onCheckedChange={setIncludeCircleInBudgets} aria-describedby="circle-budgets-description" className="flex h-6 w-11 shrink-0 items-center rounded-full bg-muted p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary">
                                        <Switch.Thumb className="block size-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5" />
                                    </Switch.Root>
                                </div>
                                <div className="flex items-center justify-between gap-5 py-5">
                                    <div>
                                        <label htmlFor="show-circle-transactions" className="text-sm">Show Circle transactions</label>
                                        <p id="circle-transactions-description" className="mt-2 text-[11px] leading-5 text-muted-foreground">Include your allocated Circle shares alongside personal transactions. Budget totals are unchanged.</p>
                                    </div>
                                    <Switch.Root id="show-circle-transactions" checked={showCircleTransactions} onCheckedChange={setShowCircleTransactions} aria-describedby="circle-transactions-description" className="flex h-6 w-11 shrink-0 items-center rounded-full bg-muted p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary">
                                        <Switch.Thumb className="block size-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5" />
                                    </Switch.Root>
                                </div>
                            </div>
                        </fieldset>
                    </section>
                    <RecurringTransactions key={recurringRevision} onEdit={onEditRecurring} />
                </Tabs.Content>
                <Tabs.Content value="Currencies" className="space-y-8 outline-none data-[state=inactive]:hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
                    <h2 className="text-sm font-medium">Currencies</h2>
                    <fieldset disabled={busy} className="space-y-6">
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
                            <label className="field-label" htmlFor="enabled-currencies">Enabled currencies</label>
                            <EnabledCurrenciesPicker value={enabled} main={main} onChange={setEnabled} />
                        </div>
                        <p className="text-[11px] leading-5 text-muted-foreground">
                            Disabling a currency hides it from new expense forms. Existing
                            expenses keep their original amounts.
                        </p>
                    </fieldset>
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
                </Tabs.Content>
                <Tabs.Content value="Categories" className="space-y-5 outline-none data-[state=inactive]:hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
                    <CategorySettings categories={categories} onCategoriesChanged={onCategoriesChanged} />
                    <p className="text-[11px] text-muted-foreground">Category changes are saved immediately.</p>
                </Tabs.Content>
                <Tabs.Content value="API" className="space-y-6 outline-none data-[state=inactive]:hidden motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150">
                    <h2 className="text-sm font-medium">API defaults</h2>
                    <fieldset disabled={busy}>
                        <div>
                            <label className="field-label" htmlFor="default-api-workspace">Default API workspace</label>
                            <SearchableSelect id="default-api-workspace" value={defaultApiCircle || "personal"} onValueChange={(value) => setDefaultApiCircle(value === "personal" ? "" : value)} onOpenChange={(open) => { if (open) setCirclesRevision((value) => value + 1); }} options={apiWorkspaceOptions} searchPlaceholder="Find a workspace…" />
                            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">New expenses sent to the general API endpoint use this workspace across all your API keys. Explicit Circle requests keep their destination.</p>
                            {circlesError && <p role="alert" className="mt-2 text-xs text-destructive">{circlesError} <button type="button" className="underline" onClick={() => setCirclesRevision((value) => value + 1)}>Retry</button></p>}
                        </div>
                    </fieldset>
                </Tabs.Content>
            </div>
            <form onSubmit={save} aria-label="Save preferences" data-settings-save-bar className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 rounded-xl border bg-popover/95 p-3 shadow-lg shadow-black/15 backdrop-blur-sm sm:p-4">
                {error && <p role="alert" className="mb-3 text-xs leading-5 text-destructive">{error}</p>}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p role="status" className="flex items-center gap-2 text-xs">
                        {busy ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-muted-foreground" /> : dirty ? <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" /> : <Check aria-hidden="true" className="size-3.5 text-primary" />}
                        {busy ? "Saving changes…" : dirty ? "Unsaved changes" : "All changes saved"}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" disabled={!dirty || busy} onClick={discard} className="h-10 flex-1 px-4 sm:flex-none">Discard</Button>
                        <Button type="submit" disabled={!dirty || busy} className="h-10 flex-1 px-5 sm:flex-none">Save changes</Button>
                    </div>
                </div>
            </form>
        </Tabs.Root>
    );
}
