declare namespace receiptCore {
    interface Item {
        label: string;
        amount: number;
        members: string[];
    }
    interface Receipt {
        input_mode: "items" | "subtotals";
        items: Item[];
        discount: number;
        service_rate_bp: number;
        service_amount: number | null;
        gst_mode: "included" | "added" | "none";
        gst_rate_bp: number;
        gst_amount: number | null;
        adjustment: number;
    }
    interface Row {
        member: string;
        items: number;
        discount: number;
        service: number;
        gst: number;
        gst_included: number;
        adjustment: number;
        amount: number;
    }
    interface Result {
        subtotal: number;
        discount: number;
        service: number;
        gst: number;
        gst_included: number;
        adjustment: number;
        amount: number;
        rows: Row[];
        shares: { member: string; amount: number }[];
    }
}
declare const receiptCore: { calculate(receipt: receiptCore.Receipt): receiptCore.Result };
export = receiptCore;
