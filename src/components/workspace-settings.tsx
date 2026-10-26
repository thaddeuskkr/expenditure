"use client";
import { useState, type FormEvent } from "react";
import {
  Archive,
  Check,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { useWorkspace } from "./workspace-context";
import {
  CURRENCY_CATALOG,
  CATEGORY_COLORS,
  TIMEZONES,
  errorMessage,
  type CategoryDefinition,
  type Preferences,
} from "@/lib/domain";
import { pb } from "@/lib/pocketbase";

export function WorkspaceSettings({
  onSave,
  onCategoriesChanged,
}: {
  onSave: (
    data: Pick<Preferences, "currency" | "timezone" | "currencies">,
  ) => Promise<void>;
  onCategoriesChanged: () => Promise<void>;
}) {
  const { preferences, categories, rates } = useWorkspace();
  const [main, setMain] = useState(preferences.currency);
  const [timezone, setTimezone] = useState(preferences.timezone);
  const [enabled, setEnabled] = useState(preferences.currencies);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<CategoryDefinition | "new" | null>(null);
  const [categoryBusy, setCategoryBusy] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({ currency: main, timezone, currencies: enabled });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function archive(category: CategoryDefinition) {
    setCategoryBusy(category.id);
    try {
      await pb.send(`/api/expenditure/categories/${category.id}`, {
        method: "PATCH",
        body: { active: !category.active },
      });
      await onCategoriesChanged();
      toast.success(
        category.active ? "Category archived" : "Category restored",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCategoryBusy("");
    }
  }
  return (
    <div className="max-w-3xl space-y-12 animate-enter">
      <form onSubmit={save} className="space-y-6">
        <h2 className="border-b pb-4 text-sm font-medium">
          Currencies & timezone
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="main-currency">
              Main currency
            </label>
            <Select value={main} onValueChange={setMain}>
              <SelectTrigger id="main-currency" className="h-10! w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {enabled.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} ·{" "}
                    {CURRENCY_CATALOG.find((c) => c.code === code)?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Used for converted amounts, combined totals, and new budgets.
            </p>
          </div>
          <div>
            <label className="field-label" htmlFor="preference-timezone">
              Timezone
            </label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="preference-timezone" className="h-10! w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <p className="field-label">Enabled currencies</p>
          <div className="flex flex-wrap gap-2">
            {enabled.map((code) => (
              <span
                key={code}
                className="flex items-center gap-2 rounded-lg border bg-white/2 py-2 pr-2 pl-3 text-xs"
              >
                {code}
                {code === main ? (
                  <span className="text-[9px] text-primary">Main</span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setEnabled((items) => items.filter((c) => c !== code))
                    }
                    aria-label={`Remove ${code}`}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
        <div className="flex max-w-lg gap-2">
          <div className="flex-1">
            <Input
              aria-label="Currency to enable"
              list="currency-catalog"
              value={adding}
              onChange={(e) => setAdding(e.target.value.toUpperCase())}
              placeholder="Currency code, e.g. JPY"
              maxLength={3}
              className="h-10"
            />
            <datalist id="currency-catalog">
              {CURRENCY_CATALOG.filter((c) => !enabled.includes(c.code)).map(
                (c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ),
              )}
            </datalist>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => {
              const code = adding.trim().toUpperCase();
              if (!CURRENCY_CATALOG.some((c) => c.code === code)) {
                setError("Choose a supported currency code.");
                return;
              }
              setEnabled((items) =>
                items.includes(code) ? items : [...items, code],
              );
              setAdding("");
              setError("");
            }}
          >
            <Plus />
            Enable
          </Button>
        </div>
        <p className="text-[11px] leading-5 text-muted-foreground">
          Disabling a currency hides it from new expense forms. Existing
          expenses keep their original amounts.
        </p>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="h-10 px-5">
          {busy ? <Loader2 className="animate-spin" /> : <Check />}Save
          preferences
        </Button>
      </form>
      <section>
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-sm font-medium">Categories</h2>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => setEditor("new")}
          >
            <Plus />
            Add category
          </Button>
        </div>
        <div className="divide-y">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`flex items-center gap-3 py-4 ${category.active ? "" : "opacity-55"}`}
            >
              <span
                className="size-2 rounded-full"
                style={{ background: category.color }}
              />
              <span className="min-w-0 flex-1 text-xs break-words">
                {category.name}
                {!category.active && (
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    Archived
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${category.name}`}
                onClick={() => setEditor(category)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${category.active ? "Archive" : "Restore"} ${category.name}`}
                disabled={!!categoryBusy}
                onClick={() => void archive(category)}
              >
                {categoryBusy === category.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : category.active ? (
                  <Archive className="size-3.5" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          Renaming updates existing expenses and budgets. Archived categories
          remain in reports.
        </p>
      </section>
      <section className="border-t pt-6">
        <h2 className="text-sm font-medium">Exchange rates</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Reference rates from{" "}
          <a
            href={rates.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            {rates.provider}
          </a>
          . Checked automatically every hour; the source usually publishes
          daily. Conversions use the latest available rates, including for past
          expenses.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {rates.fetched_at
            ? `Last fetched: ${new Date(rates.fetched_at.replace(" ", "T")).toLocaleString("en-SG", { timeZone: timezone })}`
            : "No rates cached yet."}
        </p>
      </section>
      {editor && (
        <CategoryEditor
          category={editor === "new" ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={onCategoriesChanged}
        />
      )}
    </div>
  );
}
function CategoryEditor({
  category,
  onClose,
  onSaved,
}: {
  category: CategoryDefinition | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [color, setColor] = useState(category?.color || CATEGORY_COLORS[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">
            {category ? "Edit category" : "Add category"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Set a category name and color.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5 pt-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            const name = String(
              new FormData(event.currentTarget).get("name") || "",
            ).trim();
            try {
              await pb.send(
                category
                  ? `/api/expenditure/categories/${category.id}`
                  : "/api/expenditure/categories",
                { method: category ? "PATCH" : "POST", body: { name, color } },
              );
              await onSaved();
              toast.success(category ? "Category updated" : "Category added");
              onClose();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div>
            <label className="field-label" htmlFor="category-name">
              Name
            </label>
            <Input
              id="category-name"
              name="name"
              defaultValue={category?.name}
              maxLength={60}
              required
              autoFocus
              className="h-11"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="category-color">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="category-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-10 cursor-pointer rounded border bg-transparent"
              />
              <span className="font-mono text-xs text-muted-foreground">
                {color}
              </span>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy} className="h-10 px-5">
              {busy ? <Loader2 className="animate-spin" /> : <Check />}Save
              category
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
