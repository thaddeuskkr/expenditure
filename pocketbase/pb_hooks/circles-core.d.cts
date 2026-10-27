declare namespace circlesCore {
    type SplitMode = "even" | "percentage" | "exact";
    type CircleIcon =
        | "users" |
        "plane" |
        "home" |
        "utensils" |
        "coffee" |
        "gift" |
        "briefcase" |
        "car" |
        "music" |
        "heart";
    interface SplitInput {
        member: string;
        amount?: number;
        percentage_bp?: number;
    }
    interface Share {
        member: string;
        amount: number;
        percentage_bp?: number;
    }
    interface Balance {
        member: string;
        currency: string;
        net: number;
    }
    interface SettlementSuggestion {
        from_member: string;
        to_member: string;
        currency: string;
        amount: number;
    }
}
declare const circlesCore: {
    ICONS: circlesCore.CircleIcon[];
    MAX_AMOUNT: number;
    parseDecimal(value: string, digits: number): number;
    allocate(
        amount: number,
        mode: circlesCore.SplitMode,
        shares: circlesCore.SplitInput[],
    ): circlesCore.Share[];
    suggestions(balances: circlesCore.Balance[]): circlesCore.SettlementSuggestion[];
};
export = circlesCore;
