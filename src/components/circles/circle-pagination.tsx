"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";

export function CirclePagination({
    page,
    totalPages,
    label,
    onPage,
}: {
    page: number;
    totalPages: number;
    label: string;
    onPage: (page: number) => void;
}) {
    if (totalPages <= 1) return null;
    return (
        <div className="mt-6 flex items-center justify-between border-t pt-4">
            <span className="text-[11px] text-muted-foreground">
                Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
                <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Previous ${label} page`}
                    disabled={page <= 1}
                    onClick={() => onPage(page - 1)}>
                    <ChevronLeft />
                </Button>
                <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Next ${label} page`}
                    disabled={page >= totalPages}
                    onClick={() => onPage(page + 1)}>
                    <ChevronRight />
                </Button>
            </div>
        </div>
    );
}
