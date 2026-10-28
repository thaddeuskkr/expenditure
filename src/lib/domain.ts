import type { RecordModel } from "pocketbase";
import currencyCatalog from "../../pocketbase/pb_hooks/currencies.json" with { type: "json" };
import timezoneCatalog from "../../pocketbase/pb_hooks/timezones.json" with { type: "json" };

export const CATEGORIES = [
    "Food & drinks",
    "Groceries",
    "Transport",
    "Shopping",
    "Entertainment",
    "Bills & utilities",
    "Health",
    "Other",
] as const;
export type Category = string;
export const CURRENCY_CATALOG = currencyCatalog;
export const TIMEZONES = timezoneCatalog;
export const CATEGORY_COLORS = [
    "#bfc9a4",
    "#8dada0",
    "#b7b9cf",
    "#d6b79a",
    "#a8b6c5",
    "#c9c293",
    "#c3a4af",
    "#999d94",
];
export const DEFAULT_TABS = ["Overview", "Transactions", "Categories", "Budgets", "Circles", "API keys", "Settings"] as const;
export type DefaultTab = typeof DEFAULT_TABS[number];
export type TimeFormat = "24h" | "12h";
export type Recurrence = "" | "daily" | "weekly" | "monthly" | "yearly";
export interface RecurrenceSchedule {
    recurrence: Recurrence;
    recurrence_interval: number;
    /** 0 keeps the original day; -1 means the last day of the month. */
    recurrence_day: number;
}
export interface RecurringFields extends RecurrenceSchedule {
    recurrence_next: string;
    recurrence_timezone: string;
    recurrence_error: string;
}
export function recurrenceLabel(schedule: RecurrenceSchedule) {
    const { recurrence, recurrence_interval: interval, recurrence_day: day } = schedule;
    if (!recurrence) return "";
    const units = { daily: "day", weekly: "week", monthly: "month", yearly: "year" };
    const frequency = interval === 1 ? recurrence[0].toUpperCase() + recurrence.slice(1) : `Every ${interval} ${units[recurrence]}s`;
    return frequency + (recurrence === "monthly" && day ? day === -1 ? " on the last day" : ` on day ${day}` : "");
}

export interface Expense extends RecordModel, RecurringFields {
    kind: "expense" | "income";
    merchant: string;
    /** Integer currency minor units (cents for SGD). */
    amount: number;
    currency: string;
    category: Category;
    occurred_at: string;
    notes: string;
    payment_method: string;
    source: "manual" | "api";
}
export interface Budget extends RecordModel {
    month: string;
    category: Category | "Overall";
    currency: string;
    /** Integer currency minor units (cents for SGD). */
    amount: number;
}
export interface Preferences extends RecordModel {
    show_circle_transactions: boolean;
    default_tab: DefaultTab;
    time_format: TimeFormat;
    currency: string;
    timezone: string;
    currencies: string[];
}

export interface CircleTransaction extends RecordModel, RecurringFields {
    kind: "expense" | "income";
    title: string;
    amount: number;
    allocated_amount: number;
    currency: string;
    category: string;
    budget_category: string;
    occurred_at: string;
    notes: string;
    payment_method: string;
    source: "manual" | "api";
    circle: string;
    membership_active: boolean;
    expand: { circle: { id: string; name: string; icon: string } };
}
export type Transaction = Expense | CircleTransaction;
export interface TransactionPage {
    items: Transaction[];
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}
export function isCircleTransaction(row: Transaction): row is CircleTransaction {
    return row.collectionName === "circle_expenses";
}

export function transactionName(row: Transaction) {
    return isCircleTransaction(row) ? row.title : row.merchant;
}

export function transactionAmount(row: Transaction) {
    return isCircleTransaction(row) ? row.allocated_amount : row.amount;
}

export interface CategoryDefinition {
    id: string;
    name: string;
    color: string;
    active: boolean;
    sort_order: number;
}
export interface WorkspaceConfig {
    preferences: Preferences;
    categories: CategoryDefinition[];
    used_currencies: string[];
}
export interface ExchangeRates {
    quotes: Record<string, number>;
    dates: Record<string, string>;
    fetched_at: string;
    attempted_at: string;
    stale: boolean;
    provider: string;
    source_url: string;
}
export const EMPTY_RATES: ExchangeRates = {
    quotes: { EUR: 1 },
    dates: {},
    fetched_at: "",
    attempted_at: "",
    stale: true,
    provider: "Frankfurter",
    source_url: "https://frankfurter.dev/",
};
const MAX_RATE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    created: string;
    expires_at: string;
    revoked_at: string;
    last_used: string;
}
export interface Overview {
    income: number;
    income_missing_count: number;
    total: number;
    count: number;
    previous: number;
    categories: { category: Category; total: number; count: number }[];
    activity: { occurred_at: string; total: number }[];
    missing_count: number;
    previous_missing_count: number;
    missing_currencies: string[];
    currency: string;
    original_totals: { currency: string; total: number }[];
}
export type ExpenseInput = Pick<
    Expense,
    | "kind" |
    "recurrence" |
    "recurrence_interval" |
    "recurrence_day" |
    "merchant" |
    "amount" |
    "currency" |
    "category" |
    "occurred_at" |
    "notes" |
    "payment_method"
>;

export function money(minorUnits: number, currency = "SGD") {
    const digits = currencyDigits(currency);
    return new Intl.NumberFormat("en-SG", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(minorUnits / 10 ** digits);
}

export function currencyDigits(currency: string) {
    return CURRENCY_CATALOG.find((c) => c.code === currency)?.digits ?? 2;
}

export function formatAmountInput(amount: number, currency: string) {
    return (amount / 10 ** currencyDigits(currency)).toFixed(
        currencyDigits(currency),
    );
}

export function parseMinorUnits(value: string, currency = "SGD") {
    const digits = currencyDigits(currency);
    const pattern = new RegExp(
        `^\\d{1,11}${digits ? `(\\.\\d{1,${digits}})?` : ""}$`,
    );
    if (!pattern.test(value.trim()))
        throw new Error(
            digits ?
                `Enter an amount with up to ${digits} decimal places.` :
                "Enter a whole-number amount.",
        );
    const [whole, fraction = ""] = value.trim().split(".");
    const minorUnits =
        Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
    if (minorUnits < 1 || minorUnits > 99999999999)
        throw new Error(
            `Amount must be between ${formatAmountInput(1, currency)} and ${formatAmountInput(99999999999, currency)}.`,
        );
    return minorUnits;
}

export function convertAmount(
    amount: number,
    from: string,
    to: string,
    rates: ExchangeRates,
    now = Date.now(),
) {
    if (from === to) return amount;
    if (!rates.quotes[from] || !rates.quotes[to]) return null;
    const dates = [rates.dates[from], rates.dates[to]].filter(Boolean);
    if (
        !dates.length ||
        dates.some((date) => now - Date.parse(date) > MAX_RATE_AGE_MS)
    )
        return null;
    const sourceUnits = amount / 10 ** currencyDigits(from);
    const targetUnits = (sourceUnits * rates.quotes[to]) / rates.quotes[from];
    const convertedMinorUnits = Math.round(targetUnits * 10 ** currencyDigits(to));
    return Number.isSafeInteger(convertedMinorUnits) ? convertedMinorUnits : null;
}

export function rateDate(from: string, to: string, rates: ExchangeRates) {
    return [rates.dates[from], rates.dates[to]].filter(Boolean).sort()[0] || "";
}

export function zonedDate(date: Date | string, timezone = "Asia/Singapore") {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(asDate(date));
}

export function timezoneLabel(timezone: string, date: Date | string = new Date()) {
    const offset = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "longOffset",
    }).formatToParts(asDate(date)).find((part) => part.type === "timeZoneName")!.value;
    return `${offset === "GMT" ? "GMT+00:00" : offset} · ${timezone.replaceAll("_", " ")}`;
}

export function asDate(value: Date | string) {
    return value instanceof Date ? value : new Date(value.replace(" ", "T"));
}

export function pocketbaseTimestamp(value: string) {
    return asDate(value).toISOString().replace("T", " ");
}

export function zonedInput(date: Date | string, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(asDate(date));
    const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function fromZonedInput(value: string, timezone: string) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
        throw new Error("Choose a valid date and time.");
    const target = Date.parse(`${value}:00Z`);
    if (
        !Number.isFinite(target) ||
        new Date(target).toISOString().slice(0, 16) !== value
    )
        throw new Error("Choose a valid date and time.");
    let instant = target;
    for (let i = 0; i < 4; i++) {
        const represented = Date.parse(
            `${zonedInput(new Date(instant), timezone)}:00Z`,
        );
        const difference = target - represented;
        if (difference === 0) return new Date(instant).toISOString();
        instant += difference;
    }

    throw new Error(
        "This local time does not exist because of a daylight-saving change. Choose another time.",
    );
}

export function shiftMonth(month: string, shift: number) {
    const [year, number] = month.split("-").map(Number);
    return new Date(Date.UTC(year, number - 1 + shift, 1))
        .toISOString()
        .slice(0, 7);
}

export function monthBounds(month: string, timezone: string) {
    return {
        from: fromZonedInput(`${month}-01T00:00`, timezone),
        to: fromZonedInput(`${shiftMonth(month, 1)}-01T00:00`, timezone),
        previous: fromZonedInput(`${shiftMonth(month, -1)}-01T00:00`, timezone),
    };
}

export function monthTitle(month: string) {
    return new Intl.DateTimeFormat("en-SG", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`));
}

export function dayLabel(date: string, timezone: string) {
    return new Intl.DateTimeFormat("en-SG", {
        day: "numeric",
        month: "short",
        timeZone: timezone,
    }).format(asDate(date));
}

export function timeLabel(date: Date | string, timezone: string, timeFormat: TimeFormat = "24h", includeSeconds = false) {
    return new Intl.DateTimeFormat("en-SG", {
        hour: timeFormat === "12h" ? "numeric" : "2-digit",
        minute: "2-digit",
        ...(includeSeconds ? { second: "2-digit" } : {}),
        hourCycle: timeFormat === "12h" ? "h12" : "h23",
        timeZone: timezone,
    }).format(asDate(date)).toUpperCase();
}

export function dateTimeLabel(date: Date | string, timezone: string, timeFormat: TimeFormat) {
    const day = new Intl.DateTimeFormat("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: timezone,
    }).format(asDate(date));
    return `${day}, ${timeLabel(date, timezone, timeFormat, true)}`;
}

export function errorMessage(error: unknown) {
    return error instanceof Error ?
        error.message :
        "Something went wrong. Please try again.";
}
