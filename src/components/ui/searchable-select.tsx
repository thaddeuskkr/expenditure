"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./command";

export type SelectOption = { value: string; label: string; description?: string };

export function SearchableSelect({
    id,
    value,
    onValueChange,
    onOpenChange,
    options,
    placeholder = "Select an option",
    searchPlaceholder = "Search…",
    label,
    compact = false,
    className,
}: {
    id?: string;
    value: string;
    onValueChange: (value: string) => void;
    onOpenChange?: (open: boolean) => void;
    options: SelectOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    label?: string;
    compact?: boolean;
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.value === value);
    function changeOpen(next: boolean) {
        setOpen(next);
        onOpenChange?.(next);
    }

    return (
        <Popover open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-label={label}
                    aria-expanded={open}
                    className={cn("h-10 w-full min-w-0 justify-between gap-2 bg-transparent px-3 font-normal", className)}>
                    <span className="truncate">
                        {selected ? compact ? selected.value : selected.label : placeholder}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 max-w-[calc(100vw-2rem)] p-1">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>No matches found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    keywords={[option.label, option.description || ""]}
                                    data-checked={option.value === value}
                                    onSelect={() => {
                                        onValueChange(option.value);
                                        changeOpen(false);
                                    }}>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate">{option.label}</span>
                                        {option.description && (
                                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{option.description}</span>
                                        )}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
