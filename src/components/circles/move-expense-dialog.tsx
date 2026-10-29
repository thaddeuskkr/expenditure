"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CircleModal, FormError } from "./circle-dialogs";
import { circlesApi, type Circle, type CircleDetail } from "@/lib/circles";
import { categoryLabel, errorMessage, money, type Expense } from "@/lib/domain";

export function MoveExpenseDialog({ expense, onClose, onMoved }: {
    expense: Expense;
    onClose: () => void;
    onMoved: (circle: string) => void;
}) {
    const [circles, setCircles] = useState<Circle[]>([]);
    const [circle, setCircle] = useState("");
    const [detail, setDetail] = useState<CircleDetail | null>(null);
    const [category, setCategory] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        circlesApi.list().then((index) => {
            if (!active) return;
            const available = index.circles.filter((item) => item.permissions.can_add);
            setCircles(available);
            setCircle(available[0]?.id || "");
        }).catch((failure) => {
            if (active) setError(errorMessage(failure));
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        if (!circle) return;
        let active = true;
        circlesApi.detail(circle).then((result) => {
            if (!active) return;
            const activeCategories = result.categories.filter((item) => item.active);
            const match = activeCategories.find((item) => item.name.toLowerCase() === categoryLabel(expense).toLowerCase());
            setCategory(match?.id || activeCategories.find((item) => item.name === "Other")?.id || activeCategories[0]?.id || "");
            setDetail(result);
        }).catch((failure) => { if (active) setError(errorMessage(failure)); });
        return () => {
            active = false;
        };
    }, [circle, expense]);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!detail?.circle.permissions.can_add || !category || busy) return;
        setBusy(true);
        setError("");
        try {
            await circlesApi.moveExpense(detail.circle.id, expense, category);
            onMoved(detail.circle.id);
            onClose();
        } catch (failure) {
            setError(errorMessage(failure));
        } finally {
            setBusy(false);
        }
    }

    return (
        <CircleModal title="Move expense to Circle" description={`${expense.merchant} · ${money(expense.amount, expense.currency)} ${expense.currency}`} busy={busy} onClose={onClose}>
            <form className="space-y-5 pt-2" onSubmit={submit}>
                {loading ?
                        <p role="status" className="text-xs text-muted-foreground">Loading your Circles…</p> :
                        !circles.length ?
                                <p className="text-xs text-muted-foreground">You need a Circle where you can add transactions.</p> :
                                (
                                    <>
                                        <div>
                                            <label htmlFor="move-circle" className="field-label">Circle</label>
                                            <Select
                                                value={circle}
                                                onValueChange={(value) => {
                                                    setCircle(value);
                                                    setDetail(null);
                                                    setCategory("");
                                                    setError("");
                                                }}
                                                disabled={busy}>
                                                <SelectTrigger id="move-circle" className="h-11! w-full"><SelectValue /></SelectTrigger>
                                                <SelectContent>{circles.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                        {detail ?
                                                (
                                                    <div>
                                                        <label htmlFor="move-category" className="field-label">Circle category</label>
                                                        <Select value={category} onValueChange={setCategory} disabled={busy}>
                                                            <SelectTrigger id="move-category" className="h-11! w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>{detail.categories.filter((item) => item.active).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </div>
                                                ) :
                                                <p role="status" className="text-xs text-muted-foreground">Loading Circle categories…</p>}
                                        <p className="text-xs leading-6 text-muted-foreground">This expense will leave your personal ledger. You’ll be the payer with 100% assigned to you.</p>
                                        {expense.recurrence && <p className="text-xs leading-6 text-muted-foreground">The recurring schedule moves too. Earlier occurrences stay in your personal ledger.</p>}
                                    </>
                                )}
                <FormError error={error} />
                <DialogFooter>
                    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={busy || !detail?.circle.permissions.can_add || !category}>{busy && <Loader2 className="animate-spin" />}Move expense</Button>
                </DialogFooter>
            </form>
        </CircleModal>
    );
}
