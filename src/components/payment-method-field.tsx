"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

export function PaymentMethodField({ id, defaultValue = "" }: { id: string; defaultValue?: string }) {
    const { preferences } = useWorkspace();
    const [value, setValue] = useState(defaultValue);
    return (
        <div className="flex gap-2">
            <Input id={id} name="payment_method" value={value} onChange={(event) => setValue(event.target.value)} maxLength={80} placeholder="Card, cash or another method" className="h-11 bg-secondary!" />
            {preferences.payment_methods.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button type="button" variant="outline" className="h-11 shrink-0 rounded-lg" size="icon" aria-label="Choose payment method"><ChevronDown /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-64 max-w-[calc(100vw-2rem)] overflow-y-auto">
                        <DropdownMenuItem onClick={() => setValue("")}>None</DropdownMenuItem>
                        {preferences.payment_methods.map((method) => <DropdownMenuItem key={method} onClick={() => setValue(method)} className="break-all">{method}</DropdownMenuItem>)}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
