import core from "../../pocketbase/pb_hooks/circles-core.cjs";
import type { Expense, CategoryDefinition, RecurringFields, Recurrence } from "./domain";
import { pb } from "./pocketbase";

export { core as circleCore };
export const SPLIT_LABELS = { even: "Equal", percentage: "Percentage", exact: "Exact amounts" };
export type SplitMode = core.SplitMode;
export type CircleIconName = core.CircleIcon;
export type CircleShare = core.Share;
export type CircleBalance = core.Balance;
export type SettlementSuggestion = core.SettlementSuggestion;
export interface Circle {
    id: string;
    name: string;
    icon: CircleIconName;
    currency: string;
    owner: string;
    is_owner: boolean;
    member_count: number;
    version: number;
}
export interface CircleMember {
    id: string;
    name: string;
    active: boolean;
    user: string;
    expand: { user?: { id: string; collectionId: string; name: string; avatar: string } };
}
export interface CircleExpense extends RecurringFields {
    kind: "expense" | "income";
    id: string;
    title: string;
    category: string;
    source: "manual" | "api";
    origin_expense: string;
    currency: string;
    amount: number;
    paid_by: string;
    created_by: string;
    split_mode: SplitMode;
    shares: CircleShare[];
    payment_method: string;
    notes: string;
    occurred_at: string;
    version: number;
}
export interface CircleSettlement extends SettlementSuggestion {
    id: string;
    notes: string;
    occurred_at: string;
    created_by: string;
    version: number;
}
export interface CircleInvitation {
    id: string;
    email: string;
    expires_at: string;
}
export interface IncomingInvitation extends CircleInvitation {
    circle: string;
    expand: { circle: Pick<Circle, "id" | "name" | "icon" | "currency"> };
}
export interface CirclePage<T> {
    items: T[];
    page: number;
    totalItems: number;
    totalPages: number;
}
export interface CircleDetail {
    circle: Circle;
    me: string;
    members: CircleMember[];
    balances: CircleBalance[];
    suggestions: SettlementSuggestion[];
    totals: { currency: string; total: number; income: number; count: number }[];
    recurring: CircleExpense[];
    expenses: CirclePage<CircleExpense>;
    settlements: CirclePage<CircleSettlement>;
    invitations: CircleInvitation[];
    categories: CategoryDefinition[];
}
export interface CircleIndex {
    circles: Circle[];
    invitations: IncomingInvitation[];
}
export interface CircleExpenseInput {
    category: string;
    kind: "expense" | "income";
    recurrence: Recurrence;
    title: string;
    currency: string;
    amount: number;
    paid_by: string;
    split_mode: SplitMode;
    shares: core.SplitInput[];
    payment_method: string;
    notes: string;
    occurred_at: string;
    version?: number;
}
const base = "/api/expenditure/circles";
const invitations = "/api/expenditure/circle-invitations";
export const circlesApi = {
    list: () => pb.send<CircleIndex>(base, { method: "GET" }),
    detail: (id: string, expensePage = 1, settlementPage = 1) =>
        pb.send<CircleDetail>(
            `${base}/${id}?expense_page=${expensePage}&settlement_page=${settlementPage}`,
            { method: "GET" },
        ),
    create: (data: Pick<Circle, "name" | "icon" | "currency">) =>
        pb.send<Circle>(base, { method: "POST", body: data }),
    update: (
        id: string,
        data: Partial<Pick<Circle, "name" | "icon" | "currency">> & {
            version: number;
            owner?: string;
        },
    ) => pb.send<Circle>(`${base}/${id}`, { method: "PATCH", body: data }),
    remove: (circle: Circle, confirmation: string) =>
        pb.send(`${base}/${circle.id}`, {
            method: "DELETE",
            body: { confirmation, version: circle.version },
        }),
    invite: (id: string, email: string) =>
        pb.send<CircleInvitation>(`${base}/${id}/invitations`, { method: "POST", body: { email } }),
    previewInvitation: (id: string) =>
        pb.send<IncomingInvitation>(`${invitations}/${encodeURIComponent(id)}`, { method: "GET" }),
    accept: (id: string) =>
        pb.send<{ circle: string }>(`${invitations}/${encodeURIComponent(id)}/accept`, {
            method: "POST",
        }),
    revoke: (id: string) => pb.send(`${invitations}/${id}`, { method: "DELETE" }),
    removeMember: (circle: string, member: string) =>
        pb.send(`${base}/${circle}/members/${member}`, { method: "DELETE" }),
    moveExpense: (circle: string, expense: Expense, category: string) =>
        pb.send<CircleExpense>(`${base}/${circle}/expenses/move`, {
            method: "POST", body: { expense: expense.id, previous_updated: expense.updated, category },
        }),
    copyCategories: (circle: string, previous_ids: string[]) =>
        pb.send<{ items: CategoryDefinition[] }>(`${base}/${circle}/categories/copy`, { method: "POST", body: { previous_ids } }),
    saveExpense: (circle: string, data: CircleExpenseInput, id?: string) =>
        pb.send<CircleExpense>(`${base}/${circle}/expenses${id ? "/" + id : ""}`, {
            method: id ? "PATCH" : "POST",
            body: data,
        }),
    deleteExpense: (circle: string, expense: CircleExpense) =>
        pb.send(`${base}/${circle}/expenses/${expense.id}`, {
            method: "DELETE",
            body: { version: expense.version },
        }),
    settle: (circle: string, data: SettlementSuggestion & { notes: string; occurred_at: string }) =>
        pb.send<CircleSettlement>(`${base}/${circle}/settlements`, { method: "POST", body: data }),
    undoSettlement: (circle: string, settlement: CircleSettlement) =>
        pb.send(`${base}/${circle}/settlements/${settlement.id}`, {
            method: "DELETE",
            body: { version: settlement.version },
        }),
};

export function invitationLink(id: string) {
    return `${window.location.origin}/?circle_invite=${encodeURIComponent(id)}`;
}

export function clearInvitationLink() {
    const url = new URL(window.location.href);
    url.searchParams.delete("circle_invite");
    window.history.replaceState(window.history.state, "", url);
}
