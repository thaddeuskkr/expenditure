import assert from "node:assert/strict";
import { test } from "node:test";
import receiptCore from "../pocketbase/pb_hooks/receipt-core.cjs";
import type receiptTypes from "../pocketbase/pb_hooks/receipt-core.cjs";

const a = "aaaaaaaaaaaaaaa", b = "bbbbbbbbbbbbbbb", c = "ccccccccccccccc";
function receipt(fields: Partial<receiptTypes.Receipt> = {}): receiptTypes.Receipt {
    return { input_mode: "subtotals", items: [{ label: "Alice", amount: 2000, members: [a] }, { label: "Bob", amount: 3000, members: [b] }], discount: 0, service_rate_bp: 1000, service_amount: null, gst_mode: "added", gst_rate_bp: 900, gst_amount: null, adjustment: 0, ...fields };
}

test("restaurant receipts charge GST on items and service and preserve exact shares", () => {
    const result = receiptCore.calculate(receipt());
    assert.equal(result.service, 500);
    assert.equal(result.gst, 495);
    assert.equal(result.amount, 5995);
    assert.deepEqual(result.shares, [{ member: a, amount: 2398 }, { member: b, amount: 3597 }]);
});
test("nett, GST only, service only, and included item GST with added service", () => {
    assert.equal(receiptCore.calculate(receipt({ service_rate_bp: 0, gst_mode: "included" })).amount, 5000);
    assert.equal(receiptCore.calculate(receipt({ service_rate_bp: 0 })).amount, 5450);
    assert.equal(receiptCore.calculate(receipt({ gst_mode: "none" })).amount, 5500);
    const result = receiptCore.calculate(receipt({ items: [{ label: "GST-inclusive items", amount: 10900, members: [a] }], gst_mode: "included" }));
    assert.equal(result.gst_included, 900);
    assert.equal(result.service, 1000);
    assert.equal(result.gst, 90);
    assert.equal(result.amount, 11990);
});
test("discounts precede charges; printed charge overrides and signed adjustments reconcile", () => {
    const result = receiptCore.calculate(receipt({ discount: 1000 }));
    assert.deepEqual([result.subtotal, result.discount, result.service, result.gst, result.amount], [5000, 1000, 400, 396, 4796]);
    assert.deepEqual(result.shares, [{ member: a, amount: 1918 }, { member: b, amount: 2878 }]);
    const overridden = receiptCore.calculate(receipt({ service_amount: 499, gst_amount: 496, adjustment: -5 }));
    assert.equal(overridden.amount, 5990);
    assert.equal(overridden.rows.reduce((sum, row) => sum + row.amount, 0), 5990);
    assert.equal(receiptCore.calculate(receipt({ service_amount: 0, gst_amount: 0 })).amount, 5000);
});
test("shared items and zero-rounded shares allocate every cent deterministically", () => {
    const input = receipt({ input_mode: "items", items: [{ label: "Shared", amount: 1, members: [c, b, a] }], service_rate_bp: 0, gst_mode: "none" });
    const result = receiptCore.calculate(input);
    assert.deepEqual(result.shares, [{ member: a, amount: 1 }, { member: b, amount: 0 }, { member: c, amount: 0 }]);
    assert.deepEqual(receiptCore.calculate({ ...input, items: [{ ...input.items[0], members: [a, c, b] }] }), result);
});
test("large proportional allocations agree with a BigInt reference without float loss", () => {
    for (let index = 0; index < 150; index++) {
        const items = [33333333333 - index, 22222222222 + index, 11111111111];
        const value = receipt({ items: items.map((amount, index) => ({ label: "Person", amount, members: [[a, b, c][index]] })), service_rate_bp: 0, gst_mode: "none", adjustment: index * 997 + 1 });
        const result = receiptCore.calculate(value);
        const sum = BigInt(items.reduce((a, b) => a + b, 0));
        const exact = items.map((weight, index) => ({ member: [a, b, c][index], amount: Number(BigInt(value.adjustment) * BigInt(weight) / sum), remainder: BigInt(value.adjustment) * BigInt(weight) % sum }));
        let remaining = value.adjustment - exact.reduce((sum, row) => sum + row.amount, 0);
        exact.slice().sort((a, b) => a.remainder === b.remainder ? a.member.localeCompare(b.member) : a.remainder > b.remainder ? -1 : 1).forEach((row) => {
            if (remaining > 0) {
                row.amount++;
                remaining--;
            }
        });
        assert.deepEqual(result.rows.map((row) => row.adjustment), exact.map((row) => row.amount));
        assert.equal(result.shares.reduce((sum, row) => sum + row.amount, 0), result.amount);
    }
});
test("receipt validation rejects inconsistent shapes, invalid money and participant assignments", () => {
    for (const fields of [
        { discount: 5000 }, { discount: -1 }, { service_rate_bp: 10001 }, { gst_rate_bp: 1.5 },
        { service_amount: -1 }, { gst_amount: "10" }, { adjustment: -5995 }, { adjustment: 1.5 },
        { gst_mode: "unknown" }, { gst_mode: "included", gst_amount: 10 },
        { items: [] }, { items: [{ label: "Item", amount: 0, members: [a] }] },
        { items: [{ label: "Item", amount: 1, members: [a, a] }] },
        { items: [{ label: "Item", amount: 1, members: [] }] },
        { items: [{ label: "Item", amount: 1, members: [a, b] }] },
        { items: [{ label: "Item", amount: 1, members: [a], unknown: true }] },
        { items: [{ label: " ", amount: 1, members: [a] }] },
        { input_mode: "subtotals", items: [{ label: "A", amount: 1, members: [a] }, { label: "A", amount: 1, members: [a] }] },
        { items: [{ label: "Item", amount: 99999999999, members: [a] }] },
        { unknown: true },
    ]) assert.throws(() => receiptCore.calculate(receipt(fields as Partial<receiptTypes.Receipt>)), JSON.stringify(fields));
});
test("currency-independent minor units work for zero- and three-decimal currencies", () => {
    for (const amount of [1, 1234, 99999999999]) {
        const result = receiptCore.calculate(receipt({ items: [{ label: "Item", amount, members: [a] }], service_rate_bp: 0, gst_mode: "none" }));
        assert.equal(result.amount, amount);
    }
});
