"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CircleModal, FormError, SaveButton } from "./circle-dialogs";
import { circlesApi, type CircleMember, type CirclePermissionScope, type CircleMoveScope } from "@/lib/circles";
import { errorMessage } from "@/lib/domain";

export function CirclePermissionsDialog({ circle, member, onClose, onSaved }: {
    circle: string;
    member: CircleMember;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [isAdmin, setIsAdmin] = useState(member.is_admin);
    const [canAdd, setCanAdd] = useState(member.can_add);
    const [editScope, setEditScope] = useState(member.edit_scope);
    const [deleteScope, setDeleteScope] = useState(member.delete_scope);
    const [moveScope, setMoveScope] = useState(member.move_scope);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            await circlesApi.updateMemberPermissions(circle, member, { is_admin: isAdmin, can_add: canAdd, edit_scope: editScope, delete_scope: deleteScope, move_scope: moveScope });
            toast.success("Permissions updated");
            onSaved();
            onClose();
        } catch (failure) {
            setError(errorMessage(failure));
        } finally {
            setBusy(false);
        }
    }

    return (
        <CircleModal title="Member permissions" description={member.name} busy={busy} onClose={onClose}>
            <form className="space-y-5 pt-2" onSubmit={submit}>
                <div className="flex items-center justify-between gap-4">
                    <label htmlFor="circle-permission-role" className="text-xs font-medium">Role</label>
                    <Select value={isAdmin ? "admin" : "member"} onValueChange={(value) => setIsAdmin(value === "admin")} disabled={busy}>
                        <SelectTrigger id="circle-permission-role" className="h-10! w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                    </Select>
                </div>
                {isAdmin ?
                        (
                            <section className="space-y-2 border-t pt-5" aria-labelledby="circle-admin-access">
                                <h3 id="circle-admin-access" className="text-xs font-medium">Full Circle access</h3>
                                <p className="text-xs leading-6 text-muted-foreground">Manage transactions, repayments, members and Circle settings.</p>
                                <p className="text-[11px] leading-5 text-muted-foreground">Admins cannot remove the owner, transfer ownership or delete the Circle.</p>
                            </section>
                        ) :
                        (
                            <section aria-labelledby="circle-transaction-permissions">
                                <div className="mb-3">
                                    <h3 id="circle-transaction-permissions" className="text-xs font-medium">Transactions</h3>
                                    <p className="mt-1 text-[11px] text-muted-foreground">Expenses and income</p>
                                </div>
                                <div className="divide-y border-y">
                                    <div className="flex min-h-16 items-center justify-between gap-4">
                                        <label htmlFor="circle-permission-add" className="flex-1 cursor-pointer py-3 text-xs">Add</label>
                                        <label htmlFor="circle-permission-add" className="flex min-h-10 cursor-pointer items-center gap-3 pl-3 text-xs text-muted-foreground">
                                            {canAdd ? "Allowed" : "Blocked"}
                                            <Checkbox id="circle-permission-add" aria-label="Add transactions" checked={canAdd} onCheckedChange={(checked) => setCanAdd(checked === true)} disabled={busy} />
                                        </label>
                                    </div>
                                    {([{ action: "Edit", value: editScope, change: setEditScope }, { action: "Delete", value: deleteScope, change: setDeleteScope }] as const).map(({ action, value, change }) => (
                                        <div key={action} className="flex min-h-16 items-center justify-between gap-4">
                                            <label htmlFor={`circle-permission-${action.toLowerCase()}`} className="text-xs">{action}</label>
                                            <Select value={value} onValueChange={(scope) => change(scope as CirclePermissionScope)} disabled={busy}>
                                                <SelectTrigger id={`circle-permission-${action.toLowerCase()}`} aria-label={`${action} transactions`} className="h-10! w-40 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent><SelectItem value="none">No access</SelectItem><SelectItem value="own">Own entries</SelectItem><SelectItem value="all">All entries</SelectItem></SelectContent>
                                            </Select>
                                        </div>
                                    ))}
                                    <div className="flex min-h-16 items-center justify-between gap-4">
                                        <label htmlFor="circle-permission-move" className="text-xs">Move to personal</label>
                                        <Select value={moveScope} onValueChange={(scope) => setMoveScope(scope as CircleMoveScope)} disabled={busy}>
                                            <SelectTrigger id="circle-permission-move" className="h-10! w-40 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="none">No access</SelectItem><SelectItem value="payer">Only when payer</SelectItem><SelectItem value="all">All entries</SelectItem></SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Own entries are those added by this member.</p>
                            </section>
                        )}
                <FormError error={error} />
                <DialogFooter>
                    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
                    <SaveButton busy={busy} />
                </DialogFooter>
            </form>
        </CircleModal>
    );
}
