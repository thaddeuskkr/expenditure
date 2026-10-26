"use client";
import {
  Coffee,
  ShoppingBasket,
  TrainFront,
  ShoppingBag,
  Clapperboard,
  House,
  HeartPulse,
  Ellipsis,
} from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/domain";
const icons = [
  Coffee,
  ShoppingBasket,
  TrainFront,
  ShoppingBag,
  Clapperboard,
  House,
  HeartPulse,
  Ellipsis,
];
export function CategoryIcon({
  category,
  small = false,
}: {
  category: string;
  small?: boolean;
}) {
  const { categories } = useWorkspace();
  const found = CATEGORIES.indexOf(category as (typeof CATEGORIES)[number]);
  const index = found < 0 ? 7 : found;
  const color =
    categories.find((c) => c.name === category)?.color ||
    CATEGORY_COLORS[index];
  const Icon = icons[index];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl ${small ? "size-8" : "size-10"}`}
      style={{
        color,
        background: `${color}0e`,
        border: `1px solid ${color}10`,
      }}
    >
      <Icon className={small ? "size-3.5" : "size-4"} strokeWidth={1.5} />
    </span>
  );
}
