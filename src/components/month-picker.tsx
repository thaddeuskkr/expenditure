"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { monthTitle, shiftMonth, zonedInput } from "@/lib/domain";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = Array.from({ length: 200 }, (_, index) => String(2000 + index));

export function MonthPicker({ value, onChange, timezone }: {
    value: string;
    onChange: (month: string) => void;
    timezone: string;
}) {
    const [open, setOpen] = useState(false);
    const [year, setYear] = useState(value.slice(0, 4));
    function choose(month: string) {
        onChange(month);
        setOpen(false);
    }

    return (
        <div className="inline-flex items-center gap-1 rounded-lg border bg-white/1 p-1">
            <Button type="button" variant="ghost" size="icon" aria-label="Previous month" disabled={value === "2000-01"} onClick={() => onChange(shiftMonth(value, -1))}>
                <ChevronLeft className="size-3.5" />
            </Button>
            <Popover
                open={open}
                onOpenChange={(next) => {
                    if (next) setYear(value.slice(0, 4));
                    setOpen(next);
                }}>
                <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" aria-label={`Choose month, ${monthTitle(value)}`} className="h-8 min-w-37 gap-2 px-2 text-xs font-normal">
                        <CalendarDays className="size-3.5 text-muted-foreground" />
                        {monthTitle(value)}
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 max-w-[calc(100vw-2rem)] gap-4 p-4">
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger aria-label="Year" className="h-9! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {YEARS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Month">
                        {MONTHS.map((month, index) => {
                            const key = `${year}-${String(index + 1).padStart(2, "0")}`;
                            return (
                                <Button key={month} type="button" variant={value === key ? "default" : "ghost"} aria-pressed={value === key} className="h-10 font-normal" onClick={() => choose(key)}>
                                    {month}
                                </Button>
                            );
                        })}
                    </div>
                    <Button type="button" variant="outline" className="h-9 w-full text-xs font-normal" onClick={() => choose(zonedInput(new Date(), timezone).slice(0, 7))}>
                        This month
                    </Button>
                </PopoverContent>
            </Popover>
            <Button type="button" variant="ghost" size="icon" aria-label="Next month" disabled={value === "2199-12"} onClick={() => onChange(shiftMonth(value, 1))}>
                <ChevronRight className="size-3.5" />
            </Button>
        </div>
    );
}
