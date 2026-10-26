"use client";

import { Plus, Target, Wallet } from "lucide-react";
import { Button } from "./ui/button";

export function EmptyState({
    title,
    detail,
    action,
    onAction,
    icon = "expense",
}: {
    title: string;
    detail: string;
    action?: string;
    onAction: () => void;
    icon?: "expense" | "budget";
}) {
    return (
        <div className="flex flex-col items-center py-14 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full border bg-primary/3 text-primary/60">
                {icon === "budget" ?
                        (
                            <Target className="size-5" strokeWidth={1.3} />
                        ) :
                        (
                            <Wallet className="size-5" strokeWidth={1.3} />
                        )}
            </span>
            <h3 className="font-display text-2xl">{title}</h3>
            <p className="mt-3 max-w-75 text-xs leading-6 text-muted-foreground">
                {detail}
            </p>
            {action && (
                <Button variant="outline" className="mt-5 h-9" onClick={onAction}>
                    <Plus />
                    {action}
                </Button>
            )}
        </div>
    );
}
