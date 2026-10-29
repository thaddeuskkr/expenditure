"use client";

import { useWorkspace } from "../workspace-context";
import type { CircleDetail } from "@/lib/circles";
import { Copy, UserPlus } from "lucide-react";
import { Button } from "../ui/button";
import { UserAvatar } from "../user-avatar";
import { dayLabel } from "@/lib/domain";
import type { CircleInvitation, CircleMember } from "@/lib/circles";

export function CircleMembers({
    detail,
    onInvite,
    onCopy,
    onRemove,
    onRevoke,
    onPermissions,
}: {
    detail: CircleDetail;
    onInvite: () => void;
    onCopy: (id: string) => void;
    onRemove: (member: CircleMember) => void;
    onRevoke: (invitation: CircleInvitation) => void;
    onPermissions: (member: CircleMember) => void;
}) {
    const { preferences } = useWorkspace();
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Members</h3>
                {detail.circle.can_manage && (
                    <Button variant="outline" onClick={() => onInvite()}>
                        <UserPlus />
                        Invite member
                    </Button>
                )}
            </div>
            <div className="divide-y">
                {detail.members.map((member) => (
                    <div
                        key={member.id}
                        className={`flex flex-wrap items-center gap-3 py-4 ${member.active && member.user ? "" : "opacity-55"}`}>
                        {member.expand.user && <UserAvatar user={member.expand.user} name={member.name} />}
                        <div className="min-w-0 flex-1 basis-32">
                            <p className="truncate text-xs">
                                {member.name}
                                {member.id === detail.me ? " (you)" : ""}
                            </p>
                            {member.active && member.user && member.user !== detail.circle.owner && !member.is_admin && (
                                <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                                    {member.can_add ? "Can add" : "No adding"} · Edit {member.edit_scope} · Delete {member.delete_scope} · Move {member.move_scope === "payer" ? "when payer" : member.move_scope}
                                </p>
                            )}
                            <p className="mt-1 text-[10px] text-muted-foreground">
                                {!member.active || !member.user ?
                                    "Former member" :
                                    member.user === detail.circle.owner ?
                                        "Owner" :
                                        member.is_admin ? "Admin" : "Member"}
                            </p>
                        </div>
                        {detail.circle.can_manage &&
                            member.active &&
                            member.user && member.user !== detail.circle.owner && (
                            <div className="flex shrink-0 items-center gap-1">
                                <Button variant="outline" size="sm" aria-label={`Permissions for ${member.name}`} onClick={() => onPermissions(member)}>Permissions</Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={detail.balances.some(
                                        (row) => row.member === member.id && row.net !== 0,
                                    )}
                                    onClick={() => onRemove(member)}>
                                    Remove
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
                Members must settle all currencies before leaving or being removed. Former members
                remain in expense history.
            </p>
            {detail.circle.can_manage && detail.invitations.length > 0 && (
                <div>
                    <h3 className="mb-3 text-sm font-medium">Pending invitations</h3>
                    <div className="divide-y">
                        {detail.invitations.map((invitation) => (
                            <div
                                key={invitation.id}
                                className="flex flex-wrap items-center gap-2 py-4">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs">{invitation.email}</p>
                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                        Expires{" "}
                                        {dayLabel(invitation.expires_at, preferences.timezone)}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Copy invite for ${invitation.email}`}
                                    onClick={() => void onCopy(invitation.id)}>
                                    <Copy className="size-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onRevoke(invitation)}>
                                    Revoke
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
