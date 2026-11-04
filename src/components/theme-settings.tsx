"use client";
import { Check, Plus } from "lucide-react";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { presets, colorKeys, themeError, themeVariables, type ThemeColors, type ThemePreference } from "@/lib/theme";

const labels: Record<keyof ThemeColors, string> = { background: "Background", surface: "Surface", raised: "Raised surface", accent: "Accent", text: "Text", muted: "Secondary text" };
export function ThemeSettings({ value, onChange, disabled }: { value: ThemePreference; onChange: (theme: ThemePreference) => void; disabled: boolean }) {
    const error = themeError(value);
    return (
        <fieldset disabled={disabled} className="space-y-6">
            <div>
                <label className="field-label" htmlFor="appearance-theme">Theme</label>
                <Select
                    value={value.preset}
                    onValueChange={(preset) => {
                        const selected = presets.find((item) => item.id === preset);
                        onChange({ preset: preset as ThemePreference["preset"], colors: { ...(selected?.colors ?? value.colors) } });
                    }}>
                    <SelectTrigger id="appearance-theme" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{presets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}<SelectItem value="custom">Custom</SelectItem></SelectContent>
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">Saved to your account and shared with the iPhone app.</p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Theme colours">
                {colorKeys.map((key) => <span key={key} className="size-8 rounded-full border" style={{ background: value.colors[key] }} aria-label={`${labels[key]}: ${value.colors[key]}`} />)}
            </div>
            {value.preset === "custom" && (
                <div className="grid gap-5 sm:grid-cols-2">
                    {colorKeys.map((key) => (
                        <div key={key}>
                            <label className="field-label" htmlFor={`theme-${key}`}>{labels[key]}</label>
                            <div className="flex items-center gap-3">
                                <input type="color" id={`theme-${key}`} value={/^#[a-fA-F0-9]{6}$/.test(value.colors[key]) ? value.colors[key] : "#000000"} onChange={(event) => onChange({ preset: "custom", colors: { ...value.colors, [key]: event.target.value.toUpperCase() } })} className="color-input h-11 w-14 shrink-0 border bg-secondary p-1" />
                                <Input aria-label={`${labels[key]} hex colour`} value={value.colors[key]} maxLength={7} spellCheck={false} onChange={(event) => onChange({ preset: "custom", colors: { ...value.colors, [key]: event.target.value.toUpperCase() } })} className="max-w-36 font-mono text-xs" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div style={themeVariables(value, true)} className="max-w-sm rounded-2xl border bg-background p-5 text-foreground" aria-label="Theme preview with sample amounts">
                <p className="eyebrow">Preview</p>
                <p className="mt-3 text-xs text-muted-foreground">Monthly spending · SGD</p>
                <p className="mt-1 text-3xl tracking-tight">$1,284.50</p>
                <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-card p-3 text-xs"><span>Monthly budget</span><span className="text-primary">$715.50 left</span></div>
                <div className="mt-4 flex items-center gap-2 text-xs text-primary"><Check className="size-4" />Overview</div>
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-medium text-primary-foreground"><Plus className="size-4" />Add transaction</div>
            </div>
        </fieldset>
    );
}
