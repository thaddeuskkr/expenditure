"use client";

import { useState, useSyncExternalStore } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "cn";
import { timeLabel, zonedInput } from "@/lib/domain";
import { useWorkspace } from "./workspace-context";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

const MOBILE_QUERY = "(max-width: 639px)";
function subscribeToMobileViewport(onChange: () => void) {
    const query = window.matchMedia(MOBILE_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

function isMobileViewport() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

// Keep the selected wall-clock value intact. The form converts it using its
// configured timezone, rather than the browser's timezone, when it is saved.
export function DateTimePicker({ id, name, defaultValue, timezone, className }: {
    id: string;
    name: string;
    defaultValue: string;
    timezone: string;
    className?: string;
}) {
    const { preferences } = useWorkspace();
    const twelveHour = preferences.time_format === "12h";
    const mobile = useSyncExternalStore(subscribeToMobileViewport, isMobileViewport, () => false);
    const Root = mobile ? Dialog : Popover;
    const Trigger = mobile ? DialogTrigger : PopoverTrigger;
    const [value, setValue] = useState(defaultValue);
    const [open, setOpen] = useState(false);
    const [date, time] = value.split("T");
    const [hour, minute] = time.split(":");
    const period = Number(hour) < 12 ? "AM" : "PM";
    const displayedHour = twelveHour ? String(Number(hour) % 12 || 12) : hour;
    // Format the wall clock directly; the form converts it to an instant on save.
    const displayTime = timeLabel(`${value}:00Z`, "UTC", preferences.time_format);
    // Noon avoids browser-local midnight transitions while browsing dates.
    const selected = new Date(`${date}T12:00:00`);
    const controls = (
        <>
            <Calendar
                mode="single"
                required
                selected={selected}
                today={new Date(`${zonedInput(new Date(), timezone).slice(0, 10)}T12:00:00`)}
                defaultMonth={selected}
                captionLayout="dropdown"
                startMonth={new Date(1900, 0)}
                endMonth={new Date(2199, 11)}
                onSelect={(next) => setValue(`${format(next, "yyyy-MM-dd")}T${time}`)}
                className="shrink-0 p-4 [--cell-size:--spacing(9)]"
            />
            <div className="shrink-0 space-y-3 border-t p-4">
                <div className={`grid items-center ${twelveHour ? "grid-cols-[1rem_minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)] gap-2" : "grid-cols-[1rem_minmax(0,1fr)_auto_minmax(0,1fr)] gap-3"}`}>
                    <Clock3 className="size-4 text-muted-foreground" />
                    <Select
                        value={displayedHour}
                        onValueChange={(next) => {
                            const selectedHour = twelveHour ? Number(next) % 12 + (period === "PM" ? 12 : 0) : Number(next);
                            setValue(`${date}T${String(selectedHour).padStart(2, "0")}:${minute}`);
                        }}>
                        <SelectTrigger aria-label="Hour" className="h-10! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{(twelveHour ? HOURS_12 : HOURS).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                    <span className="text-muted-foreground">:</span>
                    <Select value={minute} onValueChange={(next) => setValue(`${date}T${hour}:${next}`)}>
                        <SelectTrigger aria-label="Minute" className="h-10! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{MINUTES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                    {twelveHour && (
                        <Select
                            value={period}
                            onValueChange={(next) => {
                                const selectedHour = Number(hour) % 12 + (next === "PM" ? 12 : 0);
                                setValue(`${date}T${String(selectedHour).padStart(2, "0")}:${minute}`);
                            }}>
                            <SelectTrigger aria-label="AM/PM" className="h-10! w-full gap-1 px-2"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AM">AM</SelectItem>
                                <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="ghost" className="-ml-3 h-9 px-3 text-xs" onClick={() => setValue(zonedInput(new Date(), timezone))}>Now</Button>
                    <Button type="button" className="h-9 px-5 text-xs" onClick={() => setOpen(false)}>Done</Button>
                </div>
            </div>
        </>
    );
    return (
        <>
            <input type="hidden" name={name} value={value} />
            <Root open={open} onOpenChange={setOpen}>
                <Trigger asChild>
                    <Button id={id} type="button" variant="outline" className={cn("h-10 w-full min-w-0 justify-start gap-2 bg-transparent px-3 text-left font-normal", className)}>
                        <CalendarDays className="size-4 text-muted-foreground" />
                        <span className="truncate">{format(selected, "dd MMM yyyy")} <span className="px-1 text-muted-foreground">·</span> {displayTime}</span>
                    </Button>
                </Trigger>
                {mobile ?
                        (
                            <DialogContent className="w-auto gap-0 p-0" showCloseButton={false}>
                                <DialogHeader className="p-4 text-left">
                                    <DialogTitle>Date & time</DialogTitle>
                                    <DialogDescription className="text-xs">{timezone.replaceAll("_", " ")}</DialogDescription>
                                </DialogHeader>
                                {controls}
                            </DialogContent>
                        ) :
                        (
                            <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto p-0">
                                {controls}
                            </PopoverContent>
                        )}
            </Root>
        </>
    );
}
