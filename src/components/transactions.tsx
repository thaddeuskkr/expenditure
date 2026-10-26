"use client";

import { Ellipsis } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { CategoryIcon } from "./category-icon";
import { EmptyState } from "./empty-state";
import { useWorkspace } from "./workspace-context";
import {
  convertAmount,
  dayLabel,
  money,
  rateDate,
  type Expense,
} from "@/lib/domain";

export function Transactions({
  rows,
  timezone,
  onEdit,
  onDelete,
  emptyAction,
  filtered = false,
}: {
  rows: Expense[];
  timezone: string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  emptyAction: () => void;
  filtered?: boolean;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title={filtered ? "No matching expenses" : "No expenses"}
        detail={
          filtered
            ? "Try a different search or category."
            : "Add an expense to start tracking."
        }
        action={filtered ? undefined : "Add an expense"}
        onAction={emptyAction}
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b text-[9px] tracking-wider text-muted-foreground">
            <th className="pb-3 font-normal">MERCHANT</th>
            <th className="hidden pb-3 font-normal md:table-cell">CATEGORY</th>
            <th className="hidden pb-3 font-normal sm:table-cell">DATE</th>
            <th className="pb-3 text-right font-normal">AMOUNT</th>
            <th className="w-10 pb-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((expense) => (
            <tr
              key={expense.id}
              className="group border-b border-border/60 transition-colors hover:bg-white/1.5"
            >
              <td className="py-4 pr-4">
                <button
                  onClick={() => onEdit(expense)}
                  className="flex max-w-full items-center gap-3 text-left"
                >
                  <CategoryIcon category={expense.category} />
                  <span>
                    <span className="block max-w-32 truncate text-xs sm:max-w-52">
                      {expense.merchant}
                    </span>
                    <span className="mt-1 block max-w-36 truncate text-[9px] text-muted-foreground">
                      {expense.card ||
                        (expense.source === "api" ? "Via API" : "Manual entry")}
                    </span>
                  </span>
                </button>
              </td>
              <td className="hidden pr-4 text-[10px] text-muted-foreground md:table-cell">
                <span className="rounded-md border border-white/5 bg-white/2 px-2 py-1">
                  {expense.category}
                </span>
              </td>
              <td className="hidden pr-4 text-[10px] text-muted-foreground sm:table-cell">
                {dayLabel(expense.occurred_at, timezone)}
              </td>
              <td className="text-right text-xs whitespace-nowrap tabular-nums">
                <div>
                  {money(expense.amount_cents, expense.currency)}{" "}
                  <span className="text-[9px] text-muted-foreground">
                    {expense.currency}
                  </span>
                </div>
                <ConvertedAmount expense={expense} />
              </td>
              <td className="pl-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${expense.merchant}`}
                      className="text-muted-foreground"
                    >
                      <Ellipsis className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(expense)}>
                      Edit expense
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete(expense)}
                    >
                      Delete expense
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConvertedAmount({ expense }: { expense: Expense }) {
  const { preferences, rates } = useWorkspace();
  const mainCurrency = preferences.currency;
  if (expense.currency === mainCurrency) return null;

  const convertedAmount = convertAmount(
    expense.amount_cents,
    expense.currency,
    mainCurrency,
    rates,
  );
  const date = rateDate(expense.currency, mainCurrency, rates);
  const label = convertedAmount === null
    ? "Conversion unavailable"
    : `≈ ${money(convertedAmount, mainCurrency)} ${mainCurrency}`;

  return (
    <div
      className="mt-1 text-[10px] text-muted-foreground"
      title={`Rate date: ${date || "unavailable"}`}
    >
      {label}
    </div>
  );
}
