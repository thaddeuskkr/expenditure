"use client";

import { Plus, X } from "lucide-react";
import { CURRENCY_CATALOG } from "@/lib/domain";
import { Button } from "./ui/button";
import { SearchableSelect } from "./ui/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./ui/command";

export function CurrencyPicker({
    value,
    onChange,
    codes,
    id,
    compact,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    codes?: string[];
    id?: string;
    compact?: boolean;
    className?: string;
}) {
    return (
        <SearchableSelect
            id={id}
            label={id ? undefined : "Currency"}
            value={value}
            onValueChange={onChange}
            options={CURRENCY_CATALOG.filter((currency) => !codes || codes.includes(currency.code)).map((currency) => ({
                value: currency.code,
                label: `${currency.code} · ${currency.name}`,
            }))}
            compact={compact}
            searchPlaceholder="Search currencies…"
            className={className}
        />
    );
}

export function EnabledCurrenciesPicker({ value, main, onChange }: {
    value: string[];
    main: string;
    onChange: (codes: string[]) => void;
}) {
    function toggle(code: string) {
        if (code === main) return;
        onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
    }

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {value.map((code) => (
                    <span key={code} className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-primary/5 py-1 pr-1 pl-3 text-xs">
                        <span className="font-medium">{code}</span>
                        {code === main ?
                                (
                                    <span className="pr-2 text-[10px] text-primary">Main</span>
                                ) :
                                (
                                    <button
                                        type="button"
                                        aria-label={`Disable ${code}`}
                                        onClick={() => toggle(code)}
                                        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-ring">
                                        <X className="size-3.5" />
                                    </button>
                                )}
                    </span>
                ))}
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button id="enabled-currencies" type="button" variant="outline" className="h-10 gap-2 px-3 font-normal">
                        <Plus className="size-4" /> Manage currencies
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-1">
                    <Command>
                        <CommandInput placeholder="Search code or currency…" aria-label="Search currencies to enable" />
                        <CommandList>
                            <CommandEmpty>No currencies found.</CommandEmpty>
                            <CommandGroup>
                                {CURRENCY_CATALOG.map((currency) => (
                                    <CommandItem
                                        key={currency.code}
                                        value={currency.code}
                                        keywords={[currency.name]}
                                        disabled={currency.code === main}
                                        data-checked={value.includes(currency.code)}
                                        aria-label={`${currency.code} ${currency.name}${value.includes(currency.code) ? ", enabled" : ", not enabled"}${currency.code === main ? ", main currency" : ""}`}
                                        onSelect={() => toggle(currency.code)}>
                                        <span className="w-9 shrink-0 font-medium">{currency.code}</span>
                                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{currency.name}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
