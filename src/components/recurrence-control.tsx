"use client";
import { Switch } from "radix-ui";
import { Minus, Plus } from "lucide-react";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { dateTimeLabel, recurrenceLabel, RECURRENCE_MONTHS, RECURRENCE_WEEKDAYS, timeLabel, zonedInput, type Recurrence, type RecurrenceSchedule, type RecurringFields } from "@/lib/domain";
import { useWorkspace } from "./workspace-context";

export function RecurrenceControl({ value, onChange, start, saved, timezone, kind }: {
    value: RecurrenceSchedule;
    onChange: (value: RecurrenceSchedule) => void;
    start: string;
    saved?: (RecurringFields & { occurred_at: string }) | null;
    timezone: string;
    kind: "expense" | "income";
}) {
    const { preferences } = useWorkspace();
    const unchanged = saved && value.recurrence === saved.recurrence && value.recurrence_interval === saved.recurrence_interval && value.recurrence_day === saved.recurrence_day && value.recurrence_month === saved.recurrence_month && value.recurrence_weekdays.join(",") === saved.recurrence_weekdays.join(",") && start === zonedInput(saved.occurred_at, timezone);
    const scheduleTimezone = unchanged && saved.recurrence_timezone ? saved.recurrence_timezone : timezone;
    const localStart = unchanged ? zonedInput(saved.occurred_at, scheduleTimezone) : start;
    const entryDay = Number(localStart.slice(8, 10));
    const entryMonth = Number(localStart.slice(5, 7));
    const entryWeekday = new Date(localStart.slice(0, 10) + "T12:00:00Z").getUTCDay() || 7;
    const weekdays = value.recurrence_weekdays.length ? value.recurrence_weekdays : [entryWeekday];
    const month = value.recurrence_month || entryMonth;
    const yearlyDays = new Date(Date.UTC(2028, month, 0)).getUTCDate();
    const blank: RecurrenceSchedule = { recurrence: "", recurrence_interval: 0, recurrence_day: 0, recurrence_weekdays: [], recurrence_month: 0 };
    function changeFrequency(frequency: Recurrence) {
        onChange({ ...blank, recurrence: frequency, recurrence_interval: value.recurrence_interval || 1, recurrence_weekdays: frequency === "weekly" ? [entryWeekday] : [], recurrence_month: frequency === "yearly" ? entryMonth : 0, recurrence_day: frequency === "yearly" ? entryDay : 0 });
    }

    return (
        <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between gap-4">
                <label htmlFor="recurring-transaction" className="text-sm">Recurring {kind}</label>
                <Switch.Root id="recurring-transaction" checked={!!value.recurrence} onCheckedChange={(checked) => checked ? changeFrequency("monthly") : onChange(blank)} className="flex h-6 w-11 shrink-0 items-center rounded-full bg-muted p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary">
                    <Switch.Thumb className="block size-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5" />
                </Switch.Root>
            </div>
            {value.recurrence && (
                <div className="space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
                    <div>
                        <label className="field-label" htmlFor="repeat-interval">Repeat every</label>
                        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
                            <div className="flex h-10 items-center rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring/50">
                                <button type="button" aria-label="Decrease repeat interval" disabled={value.recurrence_interval <= 1} onClick={() => onChange({ ...value, recurrence_interval: value.recurrence_interval - 1 })} className="flex h-full w-9 shrink-0 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30"><Minus className="size-3.5" /></button>
                                <Input id="repeat-interval" type="number" inputMode="numeric" min={1} max={365} step={1} required value={value.recurrence_interval || ""} onChange={(event) => onChange({ ...value, recurrence_interval: Number(event.target.value) })} className="h-full min-w-0 rounded-none border-0 bg-transparent! px-0 text-center shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                                <button type="button" aria-label="Increase repeat interval" disabled={value.recurrence_interval >= 365} onClick={() => onChange({ ...value, recurrence_interval: value.recurrence_interval + 1 })} className="flex h-full w-9 shrink-0 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30"><Plus className="size-3.5" /></button>
                            </div>
                            <Select value={value.recurrence} onValueChange={(frequency) => changeFrequency(frequency as Recurrence)}>
                                <SelectTrigger id="repeat-frequency" aria-label="Repeat unit" className="h-10! w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {([["daily", "day"], ["weekly", "week"], ["monthly", "month"], ["yearly", "year"]] as const).map(([frequency, unit]) => <SelectItem key={frequency} value={frequency}>{unit}{value.recurrence_interval === 1 ? "" : "s"}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {value.recurrence === "weekly" && (
                        <fieldset className="min-w-0">
                            <legend className="field-label">Repeat on</legend>
                            <div className="grid grid-cols-7 gap-1.5">
                                {RECURRENCE_WEEKDAYS.map((name, index) => {
                                    const day = index + 1;
                                    const selected = weekdays.includes(day);
                                    return (
                                        <button
                                            key={name}
                                            type="button"
                                            aria-label={name}
                                            aria-pressed={selected}
                                            aria-disabled={selected && weekdays.length === 1}
                                            onClick={() => {
                                                if (selected && weekdays.length === 1) return;
                                                onChange({ ...value, recurrence_weekdays: (selected ? weekdays.filter((item) => item !== day) : [...weekdays, day]).sort((a, b) => a - b) });
                                            }}
                                            className={`h-10 min-w-0 rounded-lg border text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{name.slice(0, 3)}
                                        </button>
                                    );
                                })}
                            </div>
                            {value.recurrence_interval > 1 && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Weeks start on Monday, from this entry’s week.</p>}
                        </fieldset>
                    )}
                    {value.recurrence === "monthly" && (
                        <div>
                            <label className="field-label" htmlFor="repeat-day">Repeat on</label>
                            <Select value={String(value.recurrence_day)} onValueChange={(day) => onChange({ ...value, recurrence_day: Number(day) })}>
                                <SelectTrigger id="repeat-day" className="h-10! w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Day {entryDay} (entry date)</SelectItem>
                                    <SelectItem value="-1">Last day of the month</SelectItem>
                                    {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <SelectItem key={day} value={String(day)}>Day {day}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {(value.recurrence_day || entryDay) > 28 && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Shorter months use their last day.</p>}
                        </div>
                    )}
                    {value.recurrence === "yearly" && (
                        <fieldset className="min-w-0">
                            <legend className="field-label">Repeat on</legend>
                            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
                                <Select value={String(month)} onValueChange={(next) => onChange({ ...value, recurrence_month: Number(next), recurrence_day: value.recurrence_day === -1 ? -1 : Math.min(value.recurrence_day || entryDay, new Date(Date.UTC(2028, Number(next), 0)).getUTCDate()) })}>
                                    <SelectTrigger aria-label="Repeat month" className="h-10! w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>{RECURRENCE_MONTHS.map((name, index) => <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={String((value.recurrence_day || entryDay) > yearlyDays ? -1 : value.recurrence_day || entryDay)} onValueChange={(day) => onChange({ ...value, recurrence_day: Number(day) })}>
                                    <SelectTrigger aria-label="Repeat day" className="h-10! w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: yearlyDays }, (_, index) => index + 1).map((day) => <SelectItem key={day} value={String(day)}>{day}</SelectItem>)}
                                        <SelectItem value="-1">Last day</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {month === 2 && (value.recurrence_day || entryDay) === 29 && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Uses 28 February in non-leap years.</p>}
                        </fieldset>
                    )}
                    <div className="space-y-1 text-[11px] leading-5" aria-live="polite">
                        <p className="text-foreground">{Number.isInteger(value.recurrence_interval) && value.recurrence_interval >= 1 && value.recurrence_interval <= 365 ? recurrenceLabel(value, localStart) : "Choose a whole number from 1 to 365"}.</p>
                        <p className="text-muted-foreground">{timeLabel(`${localStart}:00Z`, "UTC", preferences.time_format)} · {scheduleTimezone.replaceAll("_", " ")}</p>
                        {unchanged && saved.recurrence_next && <p className="text-muted-foreground">Next: {dateTimeLabel(saved.recurrence_next, scheduleTimezone, preferences.time_format)}</p>}
                    </div>
                    {saved?.recurrence_error && <p role="status" className="text-xs text-destructive">Paused: {saved.recurrence_error} Save to retry after resolving this.</p>}
                </div>
            )}
        </div>
    );
}
