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
}: {
    detail: CircleDetail;
    onInvite: () => void;
    onCopy: (id: string) => void;
    onRemove: (member: CircleMember) => void;
    onRevoke: (invitation: CircleInvitation) => void;
}) {
    const { preferences } = useWorkspace();
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Members</h3>
                {detail.circle.is_owner && (
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
                        className={`flex items-center gap-3 py-4 ${member.active ? "" : "opacity-55"}`}>
                        {member.user && <UserAvatar user={member.user} name={member.name} />}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs">
                                {member.name}
                                {member.id === detail.me ? " (you)" : ""}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                                {!member.active ?
                                    "Former member" :
                                    member.user?.id === detail.circle.owner ?
                                        "Owner" :
                                        "Member"}
                            </p>
                        </div>
                        {detail.circle.is_owner &&
                            member.active &&
                            member.user?.id !== detail.circle.owner && (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={detail.balances.some(
                                    (row) => row.member === member.id && row.net !== 0,
                                )}
                                onClick={() => onRemove(member)}>
                                Remove
                            </Button>
                        )}
                    </div>
                ))}
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
                Members must settle all currencies before leaving or being removed. Former members
                remain in expense history.
            </p>
            {detail.circle.is_owner && detail.invitations.length > 0 && (
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
