"use client";
import { useState } from "react";
import { Copy } from "lucide-react";
import { ClientResponseError } from "pocketbase";
import { toast } from "sonner";
import { CategorySettings } from "../category-settings";
import { Button } from "../ui/button";
import { CircleModal, CircleConfirmDialog } from "./circle-dialogs";
import { circlesApi, type CircleDetail } from "@/lib/circles";

export function CircleCategorySettings({ data, onClose, onSaved }: {
    data: CircleDetail;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [current, setCurrent] = useState(data);
    const [copying, setCopying] = useState(false);
    async function reload() {
        setCurrent(await circlesApi.detail(data.circle.id));
        onSaved();
    }

    return (
        <CircleModal title="Circle categories" description={data.circle.name} onClose={onClose} wide>
            <CategorySettings categories={current.categories} basePath={`/api/expenditure/circles/${data.circle.id}/categories`} onCategoriesChanged={reload} readOnly={!current.circle.is_owner} action={current.circle.is_owner && <Button variant="outline" className="mt-4" onClick={() => setCopying(true)}><Copy /> Copy from my settings</Button>} />
            {copying && (
                <CircleConfirmDialog
                    title="Replace Circle categories?"
                    description="Copy your personal category names, colours, archive status, and order. Categories still used by Circle entries will be kept as archived history."
                    label="Replace categories"
                    onClose={() => setCopying(false)}
                    onConfirm={async () => {
                        try {
                            await circlesApi.copyCategories(data.circle.id, current.categories.map((item) => item.id));
                            await reload();
                            toast.success("Circle categories replaced");
                        } catch (error) {
                            if (error instanceof ClientResponseError && error.status === 409) await reload();
                            throw error;
                        }
                    }}
                />
            )}
        </CircleModal>
    );
}
