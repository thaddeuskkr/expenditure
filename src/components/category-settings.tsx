"use client";
import { useState, type ReactNode } from "react";
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, Check, Loader2, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ClientResponseError } from "pocketbase";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { CATEGORY_COLORS, errorMessage, type CategoryDefinition } from "@/lib/domain";
import { pb } from "@/lib/pocketbase";

export function CategorySettings({ categories, onCategoriesChanged, basePath = "/api/expenditure/categories", readOnly = false, action }: {
    categories: CategoryDefinition[];
    onCategoriesChanged: () => Promise<void>;
    basePath?: string;
    readOnly?: boolean;
    action?: ReactNode;
}) {
    const [editor, setEditor] = useState<CategoryDefinition | "new" | null>(null);
    const [categoryBusy, setCategoryBusy] = useState("");
    const [reordering, setReordering] = useState(false);
    const [orderStatus, setOrderStatus] = useState("");
    async function archive(category: CategoryDefinition) {
        setCategoryBusy(category.id);
        try {
            await pb.send(`${basePath}/${category.id}`, {
                method: "PATCH",
                body: { active: !category.active },
            });
            await onCategoriesChanged();
            toast.success(
                category.active ? "Category archived" : "Category restored",
            );
        } catch (e) {
            toast.error(errorMessage(e));
        } finally {
            setCategoryBusy("");
        }
    }

    async function moveCategory(index: number, direction: -1 | 1) {
        const destination = index + direction;
        if (categoryBusy || destination < 0 || destination >= categories.length) return;
        const next = categories.map((category) => category.id);
        [next[index], next[destination]] = [next[destination], next[index]];
        const category = categories[index];
        setCategoryBusy(category.id);
        try {
            await pb.send(`${basePath}/reorder`, {
                method: "POST",
                body: { ids: next, previous_ids: categories.map((item) => item.id) },
            });
            await onCategoriesChanged();
            setOrderStatus(`${category.name} moved to position ${destination + 1} of ${categories.length}.`);
        } catch (e) {
            toast.error(errorMessage(e));
            if (e instanceof ClientResponseError && e.status === 409)
                await onCategoriesChanged().catch(() => {});
        } finally {
            setCategoryBusy("");
        }
    }

    return (
        <>
            <section>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                    <h2 className="text-sm font-medium">Categories</h2>
                    {!readOnly && (
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant={reordering ? "secondary" : "ghost"}
                                className="h-9 px-3"
                                aria-label={reordering ? "Finish reordering categories" : "Reorder categories"}
                                aria-pressed={reordering}
                                disabled={!!categoryBusy || categories.length < 2}
                                onClick={() => setReordering((previous) => !previous)}>
                                {categoryBusy && reordering ? <Loader2 className="animate-spin" /> : reordering ? <Check /> : <ArrowUpDown />}
                                <span className={reordering ? "" : "hidden sm:inline"}>{reordering ? "Done" : "Reorder"}</span>
                            </Button>
                            {!reordering && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9"
                                    disabled={!!categoryBusy}
                                    onClick={() => setEditor("new")}>
                                    <Plus />
                                    Add category
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                {action}
                <div className="divide-y">
                    {categories.map((category, index) => (
                        <div
                            key={category.id}
                            className={`flex items-center gap-3 py-4 ${category.active ? "" : "opacity-55"}`}>
                            <span
                                className="size-2 rounded-full"
                                style={{ background: category.color }}
                            />
                            <span className="min-w-0 flex-1 text-xs break-words">
                                {category.name}
                                {!category.active && (
                                    <span className="ml-2 text-[10px] text-muted-foreground">
                                        Archived
                                    </span>
                                )}
                            </span>
                            {!readOnly && (reordering ?
                                    (
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Move ${category.name} up`} disabled={!!categoryBusy || index === 0} onClick={() => void moveCategory(index, -1)}>
                                                <ArrowUp className="size-4" />
                                            </Button>
                                            <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`Move ${category.name} down`} disabled={!!categoryBusy || index === categories.length - 1} onClick={() => void moveCategory(index, 1)}>
                                                <ArrowDown className="size-4" />
                                            </Button>
                                        </div>
                                    ) :
                                    (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`Edit ${category.name}`}
                                                disabled={!!categoryBusy}
                                                onClick={() => setEditor(category)}>
                                                <Pencil className="size-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`${category.active ? "Archive" : "Restore"} ${category.name}`}
                                                disabled={!!categoryBusy}
                                                onClick={() => void archive(category)}>
                                                {categoryBusy === category.id ?
                                                        (
                                                            <Loader2 className="size-3.5 animate-spin" />
                                                        ) :
                                                    category.active ?
                                                            (
                                                                <Archive className="size-3.5" />
                                                            ) :
                                                            (
                                                                <RotateCcw className="size-3.5" />
                                                            )}
                                            </Button>
                                        </>
                                    ))}
                        </div>
                    ))}
                </div>
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                    {readOnly ? "The Circle owner manages categories." : reordering ? "Changes save automatically and apply to category selectors." : "Renaming updates labels across your ledger. Archived categories remain in reports."}
                </p>
                <p role="status" className="sr-only">{orderStatus}</p>
            </section>
            {editor && <CategoryEditor basePath={basePath} category={editor === "new" ? null : editor} onClose={() => setEditor(null)} onSaved={onCategoriesChanged} />}
        </>
    );
}

function CategoryEditor({
    category,
    onClose,
    onSaved,
    basePath,
}: {
    basePath: string;
    category: CategoryDefinition | null;
    onClose: () => void;
    onSaved: () => Promise<void>;
}) {
    const [color, setColor] = useState(category?.color || CATEGORY_COLORS[0]);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !busy) onClose();
            }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="font-display text-3xl font-normal">
                        {category ? "Edit category" : "Add category"}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Set a category name and color.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="space-y-5 pt-3"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        setBusy(true);
                        setError("");
                        const name = String(
                            new FormData(event.currentTarget).get("name") || "",
                        ).trim();
                        try {
                            await pb.send(
                                category ?
                                    `${basePath}/${category.id}` :
                                    basePath,
                                { method: category ? "PATCH" : "POST", body: { name, color } },
                            );
                            await onSaved();
                            toast.success(category ? "Category updated" : "Category added");
                            onClose();
                        } catch (e) {
                            setError(errorMessage(e));
                        } finally {
                            setBusy(false);
                        }
                    }}>
                    <div>
                        <label className="field-label" htmlFor="category-name">
                            Name
                        </label>
                        <Input
                            id="category-name"
                            name="name"
                            defaultValue={category?.name}
                            maxLength={60}
                            required
                            autoFocus
                            className="h-11"
                        />
                    </div>
                    <div>
                        <label className="field-label" htmlFor="category-color">
                            Color
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                id="category-color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="size-10 cursor-pointer rounded border bg-transparent"
                            />
                            <span className="font-mono text-xs text-muted-foreground">
                                {color}
                            </span>
                        </div>
                    </div>
                    {error && (
                        <p role="alert" className="text-xs text-destructive">
                            {error}
                        </p>
                    )}
                    <DialogFooter>
                        <Button type="submit" disabled={busy} className="h-10 px-5">
                            {busy ? <Loader2 className="animate-spin" /> : <Check />}Save
                            category
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
