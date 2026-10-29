"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { CircleModal, FormError, SaveButton } from "./circle-dialogs";
import { circlesApi, type CircleMember, type CirclePermissionScope } from "@/lib/circles";
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
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            await circlesApi.updateMemberPermissions(circle, member, { is_admin: isAdmin, can_add: canAdd, edit_scope: editScope, delete_scope: deleteScope });
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
                <div>
                    <label htmlFor="circle-permission-admin" className="field-label">Admin</label>
                    <Select value={isAdmin ? "allowed" : "blocked"} onValueChange={(value) => setIsAdmin(value === "allowed")} disabled={busy}>
                        <SelectTrigger id="circle-permission-admin" className="h-11! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="allowed">Allowed</SelectItem><SelectItem value="blocked">No access</SelectItem></SelectContent>
                    </Select>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Admins have full management access and cannot remove the owner. Only the owner can transfer ownership or delete the Circle.</p>
                </div>
                <p className="text-xs leading-6 text-muted-foreground">Applies to expenses and income. Own entries are those added by this member.</p>
                <div>
                    <label htmlFor="circle-permission-add" className="field-label">Add transactions</label>
                    <Select value={isAdmin || canAdd ? "allowed" : "blocked"} onValueChange={(value) => setCanAdd(value === "allowed")} disabled={busy || isAdmin}>
                        <SelectTrigger id="circle-permission-add" className="h-11! w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="allowed">Allowed</SelectItem><SelectItem value="blocked">No access</SelectItem></SelectContent>
                    </Select>
                </div>
                {([{ action: "Edit", value: editScope, change: setEditScope }, { action: "Delete", value: deleteScope, change: setDeleteScope }] as const).map(({ action, value, change }) => (
                    <div key={action}>
                        <label htmlFor={`circle-permission-${action.toLowerCase()}`} className="field-label">{action} transactions</label>
                        <Select value={isAdmin ? "all" : value} onValueChange={(scope) => change(scope as CirclePermissionScope)} disabled={busy || isAdmin}>
                            <SelectTrigger id={`circle-permission-${action.toLowerCase()}`} className="h-11! w-full"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="none">No access</SelectItem><SelectItem value="own">Own entries only</SelectItem><SelectItem value="all">All Circle entries</SelectItem></SelectContent>
                        </Select>
                    </div>
                ))}
                <p className="text-xs leading-6 text-muted-foreground">Moving to personal also requires Edit access and being the person marked as payer.</p>
                <FormError error={error} />
                <DialogFooter>
                    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
                    <SaveButton busy={busy} />
                </DialogFooter>
            </form>
        </CircleModal>
    );
}
