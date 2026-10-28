"use client";

import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { useWorkspace } from "../workspace-context";
import { CircleModal } from "./circle-dialogs";
import { dateTimeLabel, money, type CircleTransaction } from "@/lib/domain";

export function CircleTransactionDialog({ transaction, onClose, onOpenCircle }: {
    transaction: CircleTransaction;
    onClose: () => void;
    onOpenCircle: (circle: string) => void;
}) {
    const { preferences } = useWorkspace();
    return (
        <CircleModal title={transaction.title} description={transaction.expand.circle.name} onClose={onClose}>
            <div className="space-y-5 pt-2">
                <div className="flex justify-between gap-4 text-sm">
                    <span>Your share</span>
                    <span className="tabular-nums">{money(transaction.allocated_amount, transaction.currency)} {transaction.currency}</span>
                </div>
                <p className="text-xs text-muted-foreground">Total {transaction.kind}: {money(transaction.amount, transaction.currency)} {transaction.currency}</p>
                <p className="text-xs text-muted-foreground">{transaction.category}{transaction.category !== transaction.budget_category ? ` · Personal category: ${transaction.budget_category}` : ""}</p>
                <p className="text-xs text-muted-foreground">{dateTimeLabel(transaction.occurred_at, preferences.timezone, preferences.time_format)}</p>
                {transaction.payment_method && <p className="text-xs text-muted-foreground">Payment method: {transaction.payment_method}</p>}
                {transaction.notes && <p className="text-xs leading-6 whitespace-pre-wrap text-muted-foreground">{transaction.notes}</p>}
                {transaction.membership_active && (
                    <DialogFooter>
                        <Button onClick={() => onOpenCircle(transaction.circle)}>Open Circle</Button>
                    </DialogFooter>
                )}
            </div>
        </CircleModal>
    );
}
