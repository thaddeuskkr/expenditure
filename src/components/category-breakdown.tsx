"use client";

import { ChartNoAxesCombined } from "lucide-react";
import { CategoryIcon } from "./category-icon";
import { useWorkspace } from "./workspace-context";
import { money, type Overview } from "@/lib/domain";

export function CategoryBreakdown({
    overview,
    currency,
    compact = false,
}: {
    overview: Overview;
    currency: string;
    compact?: boolean;
}) {
    const { categories: categoryDefinitions } = useWorkspace();
    if (!overview.categories.length)
        return (
            <div className="grid min-h-50 place-items-center text-center">
                <div>
                    <ChartNoAxesCombined
                        className="mx-auto mb-3 size-6 text-muted-foreground/50"
                        strokeWidth={1.3}
                    />
                    <p className="text-xs text-muted-foreground">No category data.</p>
                </div>
            </div>
        );
    const categories = compact ?
            overview.categories.slice(0, 4) :
        overview.categories;
    return (
        <div className={compact ? "space-y-5" : "space-y-7"}>
            {categories.map((item) => {
                const color =
                    categoryDefinitions.find((c) => c.name === item.category)?.color ||
                    "#999d94";
                const percent = overview.total ?
                        (item.total / overview.total) * 100 :
                    0;
                return (
                    <div key={item.category}>
                        <div className="mb-2.5 flex items-center justify-between gap-4">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                {compact ?
                                        (
                                            <span
                                                className="size-1.5 rounded-full"
                                                style={{ background: color }}
                                            />
                                        ) :
                                        (
                                            <CategoryIcon category={item.category} small />
                                        )}
                                <span
                                    className={`min-w-0 break-words ${compact ? "text-[10px]" : "text-xs"}`}>
                                    {item.category}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-3">
                                <span
                                    className={
                                        compact ?
                                            "text-[10px] tabular-nums" :
                                            "text-sm tabular-nums"
                                    }>
                                    {money(item.total, currency)}
                                </span>
                                <span className="min-w-7 text-right text-[9px] text-muted-foreground">
                                    {Math.round(percent)}%
                                </span>
                            </div>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-white/4">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${percent}%`,
                                    background: color,
                                    opacity: 0.65,
                                }}
                            />
                        </div>
                        {!compact && (
                            <p className="mt-2 text-[10px] text-muted-foreground">
                                {item.count} {item.count === 1 ? "transaction" : "transactions"}
                            </p>
                        )}
                    </div>
                );
            })}
            {compact && overview.categories.length > 4 && (
                <p className="text-[9px] text-muted-foreground">
                    + {overview.categories.length - 4} more categories
                </p>
            )}
        </div>
    );
}
