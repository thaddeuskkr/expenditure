"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { useAuth } from "../auth-provider";
import { clearInvitationLink, circlesApi, type IncomingInvitation } from "@/lib/circles";
import { errorMessage } from "@/lib/domain";
import { CircleModal, FormError } from "./circle-dialogs";
import { CircleIcon } from "./circle-icon";

export function CircleInvitationGate({ onJoined }: { onJoined: (id: string) => void }) {
    const { user, signOut } = useAuth();
    const [invitation, setInvitation] = useState<IncomingInvitation | null>(null);
    const [error, setError] = useState(""),
        [busy, setBusy] = useState(false);
    const [canSwitchAccount, setCanSwitchAccount] = useState(false);
    useEffect(() => {
        const id = new URL(window.location.href).searchParams.get("circle_invite");
        if (!id) return;
        let active = true;
        void circlesApi
            .previewInvitation(id)
            .then((value) => {
                if (active) {
                    setInvitation(value);
                    setError("");
                    setCanSwitchAccount(false);
                }
            })
            .catch((e) => {
                if (active) {
                    setError(errorMessage(e));
                    setCanSwitchAccount((e as { status?: number })?.status === 403);
                }
            });
        return () => {
            active = false;
        };
    }, [user?.id, user?.verified]);
    function close() {
        clearInvitationLink();
        setInvitation(null);
        setError("");
    }

    if (!invitation && !error) return null;
    return (
        <CircleModal
            title={invitation ? `Join ${invitation.expand.circle.name}?` : "Circle invitation"}
            onClose={close}
            busy={busy}
            description={
                invitation ?
                    `Invited as ${invitation.email}` :
                    undefined
            }>
            <div className="space-y-5 pt-3">
                {invitation && (
                    <div className="flex items-center gap-3 rounded-lg border p-4">
                        <CircleIcon name={invitation.expand.circle.icon} />
                        <span className="text-sm">{invitation.expand.circle.name}</span>
                    </div>
                )}
                <FormError error={error} />
                <DialogFooter>
                    <Button variant="outline" disabled={busy} onClick={close}>
                        Close
                    </Button>
                    {!invitation ?
                            (
                                canSwitchAccount && <Button onClick={signOut}>Switch account</Button>
                            ) :
                            (
                                <Button
                                    disabled={busy}
                                    onClick={async () => {
                                        setBusy(true);
                                        setError("");
                                        try {
                                            const result = await circlesApi.accept(invitation.id);
                                            close();
                                            onJoined(result.circle);
                                        } catch (e) {
                                            setError(errorMessage(e));
                                        } finally {
                                            setBusy(false);
                                        }
                                    }}>
                                    Join circle
                                </Button>
                            )}
                </DialogFooter>
            </div>
        </CircleModal>
    );
}
