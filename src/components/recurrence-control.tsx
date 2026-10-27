"use client";
import { Switch } from "radix-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import type { Recurrence } from "@/lib/domain";

export function RecurrenceControl({ value, onChange, next, timezone, error }: {
    value: Recurrence;
    onChange: (value: Recurrence) => void;
    next?: string;
    timezone: string;
    error?: string;
}) {
    return (
        <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between gap-4">
                <label htmlFor="recurring-expense" className="text-sm">Recurring expense</label>
                <Switch.Root id="recurring-expense" checked={!!value} onCheckedChange={(checked) => onChange(checked ? "monthly" : "")} className="flex h-6 w-11 shrink-0 items-center rounded-full bg-muted p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary">
                    <Switch.Thumb className="block size-5 rounded-full bg-background shadow transition-transform data-[state=checked]:translate-x-5" />
                </Switch.Root>
            </div>
            {value && (
                <>
                    <label className="sr-only" htmlFor="repeat-frequency">Repeat frequency</label>
                    <Select value={value} onValueChange={(frequency) => onChange(frequency as Recurrence)}>
                        <SelectTrigger id="repeat-frequency" className="h-10! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {(["daily", "weekly", "monthly", "yearly"] as const).map((frequency) => <SelectItem key={frequency} value={frequency}>{frequency[0].toUpperCase() + frequency.slice(1)}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] leading-5 text-muted-foreground">Repeats automatically in {timezone.replaceAll("_", " ")}. Turning this off stops future entries.</p>
                    {next && <p className="text-[11px] text-muted-foreground">Next: {new Date(next).toLocaleString("en-SG", { timeZone: timezone })}</p>}
                    {error && <p role="status" className="text-xs text-destructive">Paused: {error} Save to retry after resolving this.</p>}
                </>
            )}
        </div>
    );
}
