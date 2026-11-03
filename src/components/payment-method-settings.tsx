"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export function PaymentMethodSettings({ value, onChange, disabled }: { value: string[]; onChange: (methods: string[]) => void; disabled: boolean }) {
    const [name, setName] = useState("");
    const cleaned = name.trim().replace(/\s+/g, " ");
    const duplicate = value.some((method) => method.trim().toLowerCase() === cleaned.toLowerCase());
    function move(index: number, direction: number) {
        const next = [...value];
        [next[index], next[index + direction]] = [next[index + direction], next[index]];
        onChange(next);
    }

    return (
        <fieldset disabled={disabled} className="space-y-4">
            <legend className="mb-3 text-sm font-medium">Payment methods</legend>
            <p className="text-[11px] leading-5 text-muted-foreground">Saved choices for new entries. Changing a choice keeps existing transactions as they are.</p>
            <div className="divide-y">
                {value.map((method, index) => (
                    <div key={index} className="flex items-center gap-1 py-2">
                        <Input aria-label={`Payment method ${index + 1}`} value={method} maxLength={80} onChange={(event) => onChange(value.map((item, position) => position === index ? event.target.value : item))} className="h-11 bg-secondary!" />
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move payment method ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move payment method ${index + 1} down`} disabled={index === value.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove payment method ${index + 1}`} onClick={() => onChange(value.filter((_, position) => position !== index))}><X /></Button>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <Input
                    aria-label="New payment method"
                    value={name}
                    maxLength={80}
                    placeholder="Add a payment method"
                    className="h-11 bg-secondary!"
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            if (cleaned && !duplicate && value.length < 50) {
                                onChange([...value, cleaned]);
                                setName("");
                            }
                        }
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    aria-label="Add payment method"
                    disabled={!cleaned || duplicate || value.length >= 50}
                    onClick={() => {
                        onChange([...value, cleaned]);
                        setName("");
                    }}><Plus />
                </Button>
            </div>
            {duplicate && <p className="text-xs text-destructive" role="status">That payment method already exists.</p>}
        </fieldset>
    );
}
