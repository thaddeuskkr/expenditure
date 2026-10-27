import assert from "node:assert/strict";
import { test } from "node:test";
import core from "../pocketbase/pb_hooks/circles-core.cjs";

const a = "aaaaaaaaaaaaaaa",
    b = "bbbbbbbbbbbbbbb",
    c = "ccccccccccccccc";

test("equal splits allocate every minor unit deterministically, including a single participant", () => {
    assert.deepEqual(core.allocate(100, "even", [{ member: c }, { member: b }, { member: a }]), [
        { member: c, amount: 33 },
        { member: b, amount: 33 },
        { member: a, amount: 34 },
    ]);
    assert.deepEqual(core.allocate(1, "even", [{ member: b }, { member: a }]), [
        { member: b, amount: 0 },
        { member: a, amount: 1 },
    ]);
    assert.deepEqual(core.allocate(1234, "exact", [{ member: a, amount: 1234 }]), [
        { member: a, amount: 1234 },
    ]);
});
test("percentage splits use basis points and largest remainders without float drift", () => {
    const result = core.allocate(
        99999999999,
        "percentage",
        [
            { member: a, percentage_bp: 3333 },
            { member: b, percentage_bp: 3333 },
            { member: c, percentage_bp: 3334 },
        ],
    );
    assert.equal(
        result.reduce((sum, row) => sum + row.amount, 0),
        99999999999,
    );
    assert.equal(result.find((row) => row.member === c)!.percentage_bp, 3334);
    assert.throws(() => core.allocate(100, "percentage", [{ member: a, percentage_bp: 9999 }]));
    assert.throws(() => core.allocate(100, "percentage", [{ member: a, percentage_bp: 10000.1 }]));
});
test("exact splits and participants are validated, including currency precision", () => {
    assert.equal(core.parseDecimal("0.29", 2), 29);
    assert.throws(() => core.parseDecimal("1.1", 0));
    assert.throws(() => core.parseDecimal("1e2", 2));
    assert.throws(() => core.allocate(100, "exact", [{ member: a, amount: 99 }]));
    assert.throws(() => core.allocate(100, "even", [{ member: a }, { member: a }]));
    assert.throws(() => core.allocate(100, "even", []));
    assert.throws(() => core.allocate(0, "even", [{ member: a }]));
});
test("suggested settlements clear every member balance without mixing currencies", () => {
    const balances = [
        { member: a, currency: "SGD", net: 100 },
        { member: b, currency: "SGD", net: -40 },
        { member: c, currency: "SGD", net: -60 },
        { member: a, currency: "JPY", net: -1 },
        { member: b, currency: "JPY", net: 1 },
    ];
    const net = new Map(balances.map((row) => [row.member + row.currency, row.net]));
    core.suggestions(balances).forEach((row) => {
        net.set(
            row.from_member + row.currency,
            net.get(row.from_member + row.currency)! + row.amount,
        );
        net.set(
            row.to_member + row.currency,
            net.get(row.to_member + row.currency)! - row.amount,
        );
    });
    assert.ok([...net.values()].every((value) => value === 0));
    assert.throws(() => core.suggestions([{ member: a, currency: "SGD", net: 1 }]));
});
