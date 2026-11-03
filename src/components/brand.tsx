import { MoveUpRight } from "lucide-react";
export function Brand({ compact = false }: { compact?: boolean }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-primary text-background">
                <MoveUpRight className="size-4.5" strokeWidth={1.7} />
            </span>
            <span
                className={`font-display font-medium tracking-[-0.5px] ${compact ? "text-[22px]" : "text-[29px]"}`}>
                expenditure<span className="text-primary">.</span>
            </span>
        </div>
    );
}
