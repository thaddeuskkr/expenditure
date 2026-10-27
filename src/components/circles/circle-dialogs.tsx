"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { errorMessage } from "@/lib/domain";
import { CurrencyPicker } from "../currency-picker";
import {
    circleCore,
    circlesApi,
    invitationLink,
    type Circle,
    type CircleDetail,
    type CircleIconName,
} from "@/lib/circles";
import { CircleIcon } from "./circle-icon";

export function CurrencySelect({
    value,
    onChange,
    id = "circle-currency",
    codes,
}: {
    value: string;
    onChange: (code: string) => void;
    id?: string;
    codes?: string[];
}) {
    return (
        <CurrencyPicker id={id} value={value} onChange={onChange} codes={codes} />
    );
}

export function CircleModal({
    title,
    description,
    children,
    busy,
    onClose,
    wide,
}: {
    title: string;
    description?: string;
    children: ReactNode;
    busy?: boolean;
    onClose: () => void;
    wide?: boolean;
}) {
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !busy) onClose();
            }}>
            <DialogContent
                className={`max-h-[90svh] overflow-y-auto ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
                <DialogHeader>
                    <DialogTitle className="font-display text-3xl font-normal">{title}</DialogTitle>
                    <DialogDescription className={description ? "" : "sr-only"}>
                        {description || title}
                    </DialogDescription>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}

export function FormError({ error }: { error: string }) {
    return error ?
            (
                <p role="alert" className="text-xs leading-6 text-destructive">
                    {error}
                </p>
            ) :
        null;
}

export function SaveButton({ busy, label = "Save" }: { busy: boolean; label?: string }) {
    return (
        <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            {label}
        </Button>
    );
}

export function CircleSettingsDialog({
    circle,
    currency,
    onClose,
    onSaved,
}: {
    circle: Circle | null;
    currency: string;
    onClose: () => void;
    onSaved: (id: string) => void;
}) {
    const [initialCircle] = useState(circle);
    const [icon, setIcon] = useState<CircleIconName>(circle?.icon || "users");
    const [code, setCode] = useState(circle?.currency || currency);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const data = {
                name: String(new FormData(event.currentTarget).get("name")).trim(),
                icon,
                currency: code,
            };
            const result = initialCircle ?
                    await circlesApi.update(initialCircle.id, {
                        ...data,
                        version: initialCircle.version,
                    }) :
                    await circlesApi.create(data);
            onSaved(result.id);
            onClose();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <CircleModal
            title={circle ? "Circle settings" : "Create circle"}
            busy={busy}
            onClose={onClose}>
            <form onSubmit={submit} className="space-y-5 pt-3">
                <div>
                    <label htmlFor="circle-name" className="field-label">
                        Name
                    </label>
                    <Input
                        id="circle-name"
                        name="name"
                        defaultValue={circle?.name}
                        required
                        maxLength={80}
                        autoFocus
                        className="h-10"
                        placeholder="e.g. Japan trip"
                    />
                </div>
                <fieldset>
                    <legend className="field-label">Icon</legend>
                    <div className="grid grid-cols-5 gap-2">
                        {circleCore.ICONS.map((name) => (
                            <button
                                key={name}
                                type="button"
                                aria-label={`Use ${name} icon`}
                                aria-pressed={icon === name}
                                onClick={() => setIcon(name)}
                                className={`flex h-12 items-center justify-center rounded-lg border transition-colors ${icon === name ? "border-primary/60 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/5"}`}>
                                <CircleIcon name={name} />
                            </button>
                        ))}
                    </div>
                </fieldset>
                <div>
                    <label htmlFor="circle-currency" className="field-label">
                        Default currency
                    </label>
                    <CurrencySelect value={code} onChange={setCode} />
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                        New expenses use this currency. Existing amounts and balances keep their
                        original currencies.
                    </p>
                </div>
                <FormError error={error} />
                <DialogFooter>
                    <SaveButton busy={busy} label={circle ? "Save changes" : "Create circle"} />
                </DialogFooter>
            </form>
        </CircleModal>
    );
}

export function CircleConfirmDialog({
    title,
    description,
    confirmationName,
    label,
    onClose,
    onConfirm,
}: {
    title: string;
    description: string;
    confirmationName?: string;
    label: string;
    onClose: () => void;
    onConfirm: (confirmation: string) => Promise<void>;
}) {
    const [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    return (
        <CircleModal title={title} description={description} onClose={onClose} busy={busy}>
            <form
                className="space-y-5 pt-3"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                        await onConfirm(confirmation);
                        onClose();
                    } catch (e) {
                        setError(errorMessage(e));
                    } finally {
                        setBusy(false);
                    }
                }}>
                {confirmationName && (
                    <div>
                        <label htmlFor="confirm-circle" className="field-label">
                            Type {confirmationName} to confirm
                        </label>
                        <Input
                            id="confirm-circle"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            autoComplete="off"
                        />
                    </div>
                )}
                <FormError error={error} />
                <DialogFooter>
                    <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="destructive"
                        disabled={busy || (!!confirmationName && confirmation !== confirmationName)}>
                        {busy && <Loader2 className="animate-spin" />}
                        {label}
                    </Button>
                </DialogFooter>
            </form>
        </CircleModal>
    );
}

export function InviteDialog({
    circle,
    onClose,
    onSaved,
}: {
    circle: Circle;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(""),
        [link, setLink] = useState("");
    return (
        <CircleModal
            title="Invite a member"
            description="Only the account with this verified email can accept. Invitations expire after seven days."
            onClose={onClose}
            busy={busy}>
            <form
                className="space-y-5 pt-3"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                        const invitation = await circlesApi.invite(
                            circle.id,
                            String(new FormData(event.currentTarget).get("email")),
                        );
                        setLink(invitationLink(invitation.id));
                        onSaved();
                        toast.success("Invitation created");
                    } catch (e) {
                        setError(errorMessage(e));
                    } finally {
                        setBusy(false);
                    }
                }}>
                <div>
                    <label htmlFor="invite-email" className="field-label">
                        Email address
                    </label>
                    <Input
                        id="invite-email"
                        name="email"
                        type="email"
                        maxLength={254}
                        required
                        autoFocus
                        disabled={!!link}
                        placeholder="friend@example.com"
                    />
                </div>
                {link && (
                    <div>
                        <label htmlFor="invite-link" className="field-label">
                            Invitation link
                        </label>
                        <div className="flex gap-2">
                            <Input
                                id="invite-link"
                                value={link}
                                readOnly
                                onFocus={(e) => e.target.select()}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                aria-label="Copy invitation link"
                                onClick={() =>
                                    void navigator.clipboard
                                        .writeText(link)
                                        .then(() => toast.success("Link copied"))
                                        .catch(() => toast.error("Select and copy the link."))}>
                                <Copy />
                            </Button>
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                            Share this link with your friend. The invitation also appears in their
                            Circles inbox.
                        </p>
                    </div>
                )}
                <FormError error={error} />
                <DialogFooter>
                    {link ?
                            (
                                <Button type="button" onClick={onClose}>
                                    Done
                                </Button>
                            ) :
                            (
                                <SaveButton busy={busy} label="Create invitation" />
                            )}
                </DialogFooter>
            </form>
        </CircleModal>
    );
}

export function TransferDialog({
    data,
    onClose,
    onSaved,
}: {
    data: CircleDetail;
    onClose: () => void;
    onSaved: () => void;
}) {
    const eligible = data.members.filter(
        (member) => member.active && member.user && member.user !== data.circle.owner,
    );
    const [owner, setOwner] = useState(eligible[0]?.user || "");
    const [version] = useState(data.circle.version);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState("");
    return (
        <CircleModal
            title="Transfer ownership"
            description="The new owner will control invitations, settings, and deletion. You will remain a member."
            busy={busy}
            onClose={onClose}>
            <form
                className="space-y-5 pt-3"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                        await circlesApi.update(data.circle.id, {
                            owner,
                            version,
                        });
                        onSaved();
                        onClose();
                    } catch (e) {
                        setError(errorMessage(e));
                    } finally {
                        setBusy(false);
                    }
                }}>
                <div>
                    <label htmlFor="new-owner" className="field-label">
                        New owner
                    </label>
                    <Select value={owner} onValueChange={setOwner}>
                        <SelectTrigger id="new-owner" className="w-full">
                            <SelectValue placeholder="Invite another member first" />
                        </SelectTrigger>
                        <SelectContent>
                            {eligible.map((item) => (
                                <SelectItem key={item.id} value={item.user}>
                                    {item.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <FormError error={error} />
                <DialogFooter>
                    <Button type="submit" disabled={busy || !owner}>
                        {busy && <Loader2 className="animate-spin" />}Transfer ownership
                    </Button>
                </DialogFooter>
            </form>
        </CircleModal>
    );
}
