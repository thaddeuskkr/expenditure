"use client";
import { createContext, useContext } from "react";
import type { WorkspaceConfig, ExchangeRates } from "@/lib/domain";
export const WorkspaceContext = createContext<
  (WorkspaceConfig & { rates: ExchangeRates }) | null
>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace context is unavailable.");
  return context;
}
