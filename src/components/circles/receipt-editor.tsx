"use client";

import { useRef } from "react";
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { money, formatAmountInput, currencyDigits } from "@/lib/domain";
import { circleCore, type CircleMember, type CircleReceipt, type ReceiptResult } from "@/lib/circles";

export interface ReceiptDraft {
    input_mode: "items" | "subtotals";
    items: { id: string; label: string; amount: string; members: string[] }[];
    discount: string;
    service_rate: string;
    service_amount: string;
    gst_mode: CircleReceipt["gst_mode"];
    gst_rate: string;
    gst_amount: string;
    adjustment: string;
}

export function receiptDraft(receipt: CircleReceipt | null | undefined, members: CircleMember[], currency: string): ReceiptDraft {
    return {
        input_mode: receipt?.input_mode || "subtotals",
        items: receipt ?
            receipt.input_mode === "subtotals" ?
                    members.map((member) => {
                        const item = receipt.items.find((item) => item.members[0] === member.id);
                        return { id: member.id, label: member.name, amount: item ? formatAmountInput(item.amount, currency) : "", members: [member.id] };
                    }) :
                    receipt.items.map((item, index) => ({ ...item, id: String(index), amount: formatAmountInput(item.amount, currency) })) :
                members.filter((member) => member.active).map((member) => ({ id: member.id, label: member.name, amount: "", members: [member.id] })),
        discount: receipt?.discount ? formatAmountInput(receipt.discount, currency) : "",
        service_rate: receipt ? String(receipt.service_rate_bp / 100) : "10",
        service_amount: receipt?.service_amount != null ? formatAmountInput(receipt.service_amount, currency) : "",
        gst_mode: receipt?.gst_mode || "added",
        gst_rate: receipt ? String(receipt.gst_rate_bp / 100) : "9",
        gst_amount: receipt?.gst_amount != null ? formatAmountInput(receipt.gst_amount, currency) : "",
        adjustment: receipt?.adjustment ? `${receipt.adjustment < 0 ? "-" : ""}${formatAmountInput(Math.abs(receipt.adjustment), currency)}` : "",
    };
}

export function parseReceipt(draft: ReceiptDraft, currency: string): CircleReceipt {
    const parse = (value: string) => circleCore.parseDecimal(value.trim() || "0", currencyDigits(currency));
    const adjustment = draft.adjustment.trim();
    return {
        input_mode: draft.input_mode,
        items: draft.items.filter((item) => draft.input_mode === "items" || (item.amount.trim() && parse(item.amount) > 0)).map((item) => ({ label: item.label.trim(), amount: parse(item.amount), members: item.members })),
        discount: parse(draft.discount),
        service_rate_bp: circleCore.parseDecimal(draft.service_rate || "0", 2),
        service_amount: draft.service_amount.trim() ? parse(draft.service_amount) : null,
        gst_mode: draft.gst_mode,
        gst_rate_bp: circleCore.parseDecimal(draft.gst_rate || "0", 2),
        gst_amount: draft.gst_amount.trim() ? parse(draft.gst_amount) : null,
        adjustment: parse(adjustment.replace(/^-/, "")) * (adjustment.startsWith("-") ? -1 : 1),
    };
}

function AmountField({ label, value, onChange, placeholder = "0.00" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
    return <Input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" placeholder={placeholder} className="h-10 text-right tabular-nums md:text-xs" />;
}

export function ReceiptSummary({ result, currency, receipt }: { result: ReceiptResult; currency: string; receipt: CircleReceipt }) {
    const lines: [string, number][] = [
        ["Items", result.subtotal],
        ...(result.discount ? [["Discount", -result.discount] as [string, number]] : []),
        ...(result.service || receipt.service_rate_bp ? [[`Service charge${receipt.service_amount === null ? ` (${receipt.service_rate_bp / 100}%)` : ""}`, result.service] as [string, number]] : []),
        ...(result.gst || receipt.gst_mode === "added" ? [[receipt.gst_mode === "included" ? "GST on service charge" : `GST${receipt.gst_amount === null ? ` (${receipt.gst_rate_bp / 100}%)` : ""}`, result.gst] as [string, number]] : []),
        ...(result.adjustment ? [["Adjustment", result.adjustment] as [string, number]] : []),
    ];
    return (
        <div className="rounded-xl border border-primary/15 bg-primary/4 px-4 py-4 sm:px-5">
            <div className="mb-4 flex items-center gap-2 text-primary"><ReceiptText className="size-4" aria-hidden="true" /><span className="text-[10px] font-medium tracking-[0.16em] uppercase">Receipt total</span></div>
            <dl className="space-y-2 text-xs">
                {lines.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="shrink-0 tabular-nums">{value < 0 ? "−" : ""}{money(Math.abs(value), currency)}</dd></div>)}
                <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-dashed border-primary/20 pt-4"><dt className="font-medium">Total</dt><dd aria-live="polite" className="text-2xl tracking-tight tabular-nums">{money(result.amount, currency)} <span className="text-[10px] tracking-normal text-muted-foreground">{currency}</span></dd></div>
            </dl>
            {receipt.gst_mode === "included" && <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Item prices include {money(result.gst_included, currency)} GST ({receipt.gst_rate_bp / 100}%).</p>}
        </div>
    );
}

export function ReceiptEditor({ draft, onChange, members, me, currency, result, error }: {
    draft: ReceiptDraft;
    onChange: (draft: ReceiptDraft) => void;
    members: CircleMember[];
    me: string;
    currency: string;
    result: ReceiptResult | null;
    error: string;
}) {
    const itemSnapshot = useRef<{ items: ReceiptDraft["items"]; subtotals: string } | null>(null);
    function patch(fields: Partial<ReceiptDraft>) {
        onChange({ ...draft, ...fields });
    }

    function update(id: string, fields: Partial<ReceiptDraft["items"][number]>) {
        patch({ items: draft.items.map((item) => item.id === id ? { ...item, ...fields } : item) });
    }

    function changeInput(mode: ReceiptDraft["input_mode"]) {
        if (mode === draft.input_mode) return;
        if (mode === "items") {
            const restored = itemSnapshot.current?.subtotals === JSON.stringify(draft.items) ? itemSnapshot.current.items : null;
            const entered = draft.items.filter((item) => item.amount.trim());
            patch({ input_mode: mode, items: restored || (entered.length ? entered : [{ id: crypto.randomUUID(), label: "", amount: "", members: [me] }]) });
        } else {
            const items = members.map((member) => {
                const row = result?.rows.find((item) => item.member === member.id);
                return { id: member.id, label: member.name, amount: row ? formatAmountInput(row.items, currency) : "", members: [member.id] };
            });
            itemSnapshot.current = { items: draft.items, subtotals: JSON.stringify(items) };
            patch({ input_mode: mode, items });
        }
    }

    const preset = draft.service_amount || draft.gst_amount ? "custom" : draft.gst_mode === "included" && draft.service_rate === "0" ? "nett" : draft.gst_mode === "added" && draft.service_rate === "10" && draft.gst_rate === "9" ? "restaurant" : draft.gst_mode === "added" && draft.service_rate === "0" && draft.gst_rate === "9" ? "gst" : "custom";
    return (
        <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
            <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xs font-medium">What did everyone have?</h3><div className="flex rounded-lg bg-background/40 p-0.5">{([["subtotals", "Per person"], ["items", "By item"]] as const).map(([mode, label]) => <Button key={mode} type="button" variant={draft.input_mode === mode ? "secondary" : "ghost"} aria-pressed={draft.input_mode === mode} className="h-8 px-3 text-[11px]" disabled={mode === "subtotals" && draft.input_mode === "items" && !result && draft.items.some((item) => item.label.trim() || item.amount.trim())} onClick={() => changeInput(mode)}>{label}</Button>)}</div></div>
                {draft.input_mode === "subtotals" ?
                        (
                            <div className="divide-y border-y">
                                {draft.items.map((item) => {
                                    const member = members.find((member) => member.id === item.members[0]);
                                    return <div key={item.id} className="flex items-center gap-3 py-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary" aria-hidden="true">{item.label.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1 truncate text-xs">{member?.name || item.label}{item.members[0] === me ? " (you)" : ""}{!member?.active ? " · former" : ""}</span><div className="w-28 shrink-0"><AmountField label={`${item.label} item subtotal`} value={item.amount} onChange={(amount) => update(item.id, { amount })} placeholder={formatAmountInput(0, currency)} /></div></div>;
                                })}
                            </div>
                        ) :
                        (
                            <div className="space-y-3">
                                {draft.items.map((item, index) => (
                                    <div key={item.id} className="rounded-lg border px-3 py-3">
                                        <div className="flex items-center gap-2"><span className="w-4 shrink-0 text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><Input aria-label={`Item ${index + 1} name`} value={item.label} maxLength={120} onChange={(event) => update(item.id, { label: event.target.value })} placeholder="Item name" className="h-10 flex-1 md:text-xs" /><div className="w-24 shrink-0 sm:w-28"><AmountField label={`Item ${index + 1} total`} value={item.amount} onChange={(amount) => update(item.id, { amount })} placeholder={formatAmountInput(0, currency)} /></div><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove item ${index + 1}`} onClick={() => patch({ items: draft.items.filter((row) => row.id !== item.id) })}><Trash2 className="size-3.5" /></Button></div>
                                        <div className="mt-3 flex flex-wrap gap-2 pl-6">{members.map((member) => <label key={member.id} className={`flex max-w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-[10px] transition-colors ${item.members.includes(member.id) ? "border-primary/25 bg-primary/8 text-primary" : "border-transparent text-muted-foreground hover:bg-white/4"}`}><Checkbox className="size-3.5" aria-label={`${item.label || `Item ${index + 1}`} for ${member.name}`} checked={item.members.includes(member.id)} onCheckedChange={(checked) => update(item.id, { members: checked === true ? [...item.members, member.id] : item.members.filter((id) => id !== member.id) })} /><span className="truncate">{member.name}{member.id === me ? " (you)" : ""}</span></label>)}</div>
                                    </div>
                                ))}
                                <Button type="button" variant="ghost" className="h-9 w-full border border-dashed text-xs text-primary" disabled={draft.items.length >= 100} onClick={() => patch({ items: [...draft.items, { id: crypto.randomUUID(), label: "", amount: "", members: [me] }] })}><Plus className="size-3.5" />Add item</Button>
                                <p className="text-[10px] text-muted-foreground">Enter each line total. Shared items are split equally among the selected people.</p>
                            </div>
                        )}
            </div>
            <div>
                <h3 className="mb-3 text-xs font-medium">How are charges shown?</h3>
                <div className="grid grid-cols-3 gap-2">{([
                    ["nett", "Nett", "GST included", "0", "included"],
                    ["restaurant", "Service + GST", "10% + 9%", "10", "added"],
                    ["gst", "GST only", "+9%", "0", "added"],
                ] as const).map(([value, label, hint, service, gst]) => <button key={value} type="button" aria-pressed={preset === value} onClick={() => patch({ service_rate: service, gst_mode: gst, gst_rate: "9", service_amount: "", gst_amount: "" })} className={`min-w-0 rounded-lg border px-2 py-3 text-left transition-colors sm:px-3 ${preset === value ? "border-primary/40 bg-primary/8 text-primary" : "hover:border-primary/20 hover:bg-white/3"}`}><span className="block text-[11px] font-medium">{label}</span><span className="mt-1 block text-[10px] text-muted-foreground">{hint}</span></button>)}
                </div>
                <details className="group mt-3">
                    <summary className="w-fit cursor-pointer py-1 text-[11px] text-muted-foreground transition-colors hover:text-primary">Custom charges & discounts</summary>
                    <div className="mt-3 grid grid-cols-2 gap-4 rounded-lg bg-background/25 p-3 sm:p-4">
                        <label className="min-w-0"><span className="field-label">Service charge %</span><AmountField label="Service charge percentage" value={draft.service_rate} onChange={(service_rate) => patch({ service_rate, service_amount: "" })} placeholder="10" /></label>
                        <div className="min-w-0"><label htmlFor="receipt-gst-mode" className="field-label">GST</label><Select value={draft.gst_mode} onValueChange={(gst_mode: CircleReceipt["gst_mode"]) => patch({ gst_mode, gst_amount: "" })}><SelectTrigger id="receipt-gst-mode" className="h-10! w-full text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="added">Added on top</SelectItem><SelectItem value="included">Included in items</SelectItem><SelectItem value="none">No GST</SelectItem></SelectContent></Select></div>
                        <label className="min-w-0"><span className="field-label">GST %</span><AmountField label="GST percentage" value={draft.gst_rate} onChange={(gst_rate) => patch({ gst_rate, gst_amount: "" })} placeholder="9" /></label>
                        <label className="min-w-0"><span className="field-label">Discount</span><AmountField label="Receipt discount" value={draft.discount} onChange={(discount) => patch({ discount })} placeholder={formatAmountInput(0, currency)} /></label>
                        <label className="min-w-0"><span className="field-label">Service amount</span><AmountField label="Service charge receipt amount" value={draft.service_amount} onChange={(service_amount) => patch({ service_amount })} placeholder="Auto" /></label>
                        {draft.gst_mode === "added" && <label className="min-w-0"><span className="field-label">GST amount</span><AmountField label="GST receipt amount" value={draft.gst_amount} onChange={(gst_amount) => patch({ gst_amount })} placeholder="Auto" /></label>}
                        <label className="min-w-0"><span className="field-label">Adjustment (+ / −)</span><AmountField label="Receipt adjustment" value={draft.adjustment} onChange={(adjustment) => patch({ adjustment })} placeholder={formatAmountInput(0, currency)} /></label>
                        <p className="col-span-2 text-[10px] leading-5 text-muted-foreground">Discounts apply before charges. GST applies to service charge too. Enter printed charge amounts to match the receipt; leave blank to calculate.</p>
                    </div>
                </details>
            </div>
            {result ?
                    (
                        <>
                            <ReceiptSummary result={result} currency={currency} receipt={parseReceipt(draft, currency)} />
                            <div><h3 className="mb-1 text-xs font-medium">Everyone pays</h3><div className="divide-y">{result.rows.map((row) => <div key={row.member} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-xs">{members.find((member) => member.id === row.member)?.name || "Former member"}{row.member === me ? " (you)" : ""}</p><p className="mt-1 text-[10px] leading-5 text-muted-foreground">Items {money(row.items, currency)}{row.discount ? ` − ${money(row.discount, currency)} discount` : ""}{row.service ? ` + ${money(row.service, currency)} service` : ""}{row.gst ? ` + ${money(row.gst, currency)} GST` : ""}{row.adjustment ? ` ${row.adjustment < 0 ? "−" : "+"} ${money(Math.abs(row.adjustment), currency)} adjustment` : ""}</p></div><p className="shrink-0 text-sm tabular-nums text-primary">{money(row.amount, currency)}</p></div>)}</div><p className="mt-1 text-[10px] leading-5 text-muted-foreground">Charges follow each person’s items. Rounding cents are distributed automatically.</p></div>
                        </>
                    ) :
                    <div className="rounded-xl border border-dashed px-4 py-5"><p className="text-xs text-muted-foreground">{draft.items.some((item) => item.amount.trim()) ? error : "Enter item amounts to see the receipt and everyone’s share."}</p></div>}
        </div>
    );
}
