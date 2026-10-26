import { MoveUpRight } from "lucide-react";
export function Brand({ compact = false }: { compact?: boolean }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[9px] bg-[#c2cbb0] text-[#242a21]">
                <MoveUpRight className="size-4.5" strokeWidth={1.7} />
            </span>
            <span
                className={`font-display tracking-[-0.6px] ${compact ? "text-2xl" : "text-[28px]"}`}>
                expenditure<span className="text-[#b9c4a2]">.</span>
            </span>
        </div>
    );
}
