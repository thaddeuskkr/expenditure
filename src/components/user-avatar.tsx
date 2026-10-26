"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pocketbase";

export function UserAvatar({ user, name }: { user: RecordModel; name: string }) {
    const file = Array.isArray(user.avatar) ? user.avatar[0] : user.avatar;
    const filename = typeof file === "string" ? file : "";
    const publicUrl = filename ? pb.files.getURL(user, filename, { thumb: "100x100" }) : "";
    const [protectedImage, setProtectedImage] = useState({ publicUrl: "", url: "" });
    const [failedUrl, setFailedUrl] = useState("");
    const attemptedPrivateUrl = useRef("");
    const src = protectedImage.publicUrl === publicUrl ? protectedImage.url : publicUrl;

    async function handleImageError() {
        setFailedUrl(src);
        if (attemptedPrivateUrl.current === publicUrl) return;
        attemptedPrivateUrl.current = publicUrl;
        try {
            // Protected files use a short-lived file token, never the login token.
            const token = await pb.files.getToken();
            if (!token) return;
            setProtectedImage({
                publicUrl,
                url: pb.files.getURL(user, filename, { thumb: "100x100", token }),
            });
        } catch {
            // Missing files and denied access keep the initials visible.
        }
    }

    return (
        <span
            aria-hidden="true"
            className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#363e30] text-[11px] text-[#d4dcc6]">
            {name.slice(0, 2).toUpperCase()}
            {src && failedUrl !== src && (
                <Image
                    src={src}
                    alt=""
                    width={32}
                    height={32}
                    unoptimized
                    className="absolute inset-0 size-full object-cover"
                    onError={() => void handleImageError()}
                />
            )}
        </span>
    );
}
