"use client";
import { Switch } from "radix-ui";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { dateTimeLabel, recurrenceLabel, type Recurrence, type RecurrenceSchedule } from "@/lib/domain";
import { useWorkspace } from "./workspace-context";

export function RecurrenceControl({ value, onChange, next, timezone, error, kind }: {
    value: RecurrenceSchedule;
    onChange: (value: RecurrenceSchedule) => void;
    next?: string;
    timezone: string;
    error?: string;
    kind: "expense" | "income";
}) {
    const { preferences } = useWorkspace();
    return (
        <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-4">
                <label htmlFor="recurring-transaction" className="text-sm">Recurring {kind}</label>
                <Switch.Root id="recurring-transaction" checked={!!value.recurrence} onCheckedChange={(checked) => onChange({ recurrence: checked ? "monthly" : "", recurrence_interval: checked ? 1 : 0, recurrence_day: 0 })} className="flex h-6 w-11 shrink-0 items-center rounded-full bg-muted p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary">
                    <Switch.Thumb className="block size-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5" />
                </Switch.Root>
            </div>
            {value.recurrence && (
                <>
                    <div>
                        <label className="field-label" htmlFor="repeat-interval">Repeat every</label>
                        <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
                            <Input id="repeat-interval" type="number" inputMode="numeric" min={1} max={365} step={1} required value={value.recurrence_interval || ""} onChange={(event) => onChange({ ...value, recurrence_interval: Number(event.target.value) })} className="h-10" />
                            <Select value={value.recurrence} onValueChange={(frequency) => onChange({ ...value, recurrence: frequency as Recurrence, recurrence_day: 0 })}>
                                <SelectTrigger id="repeat-frequency" aria-label="Repeat unit" className="h-10! w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {([["daily", "day"], ["weekly", "week"], ["monthly", "month"], ["yearly", "year"]] as const).map(([frequency, unit]) => <SelectItem key={frequency} value={frequency}>{unit}{value.recurrence_interval === 1 ? "" : "s"}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {value.recurrence === "monthly" && (
                        <div>
                            <label className="field-label" htmlFor="repeat-day">On</label>
                            <Select value={String(value.recurrence_day)} onValueChange={(day) => onChange({ ...value, recurrence_day: Number(day) })}>
                                <SelectTrigger id="repeat-day" className="h-10! w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Same day as this entry</SelectItem>
                                    <SelectItem value="-1">Last day of the month</SelectItem>
                                    {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <SelectItem key={day} value={String(day)}>Day {day}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {(value.recurrence_day === 0 || value.recurrence_day > 28) && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Shorter months use their last day.</p>}
                        </div>
                    )}
                    <p className="text-[11px] leading-5 text-muted-foreground">{recurrenceLabel(value)} in {timezone.replaceAll("_", " ")}, at this entry’s time. Turning this off stops future entries.</p>
                    {next && <p className="text-[11px] text-muted-foreground">Next: {dateTimeLabel(next, timezone, preferences.time_format)}</p>}
                    {error && <p role="status" className="text-xs text-destructive">Paused: {error} Save to retry after resolving this.</p>}
                </>
            )}
        </div>
    );
}
