import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fromZonedInput,
  monthBounds,
  parseMinorUnits,
  shiftMonth,
  money,
  convertAmount,
  EMPTY_RATES,
} from "../src/lib/domain.ts";
test("decimal amounts are parsed exactly into integer cents", () => {
  assert.equal(parseMinorUnits("8.50"), 850);
  assert.equal(parseMinorUnits("0.29"), 29);
  assert.equal(parseMinorUnits("1.1"), 110);
  assert.equal(parseMinorUnits("999999999.99"), 99999999999);
  for (const value of [
    "0",
    "-1",
    "1.005",
    "NaN",
    "Infinity",
    "1e3",
    "1,000",
    "1000000000",
  ])
    assert.throws(() => parseMinorUnits(value));
});
test("currency amounts use their ISO precision and conversions round per expense", () => {
  assert.equal(parseMinorUnits("1200", "JPY"), 1200);
  assert.throws(() => parseMinorUnits("1200.5", "JPY"));
  assert.equal(parseMinorUnits("1.234", "KWD"), 1234);
  assert.throws(() => parseMinorUnits("1.2345", "KWD"));
  assert.ok(money(1234, "KWD").includes("1.234"));
  const now = Date.parse("2026-10-27T10:00:00Z");
  const snapshot = {
    ...EMPTY_RATES,
    quotes: { EUR: 1, SGD: 1.5, USD: 1.2, JPY: 150, KWD: 0.3 },
    dates: {
      SGD: "2026-10-26",
      USD: "2026-10-26",
      JPY: "2026-10-26",
      KWD: "2026-10-26",
    },
  };
  assert.equal(convertAmount(1000, "JPY", "SGD", snapshot, now), 1000);
  assert.equal(convertAmount(1234, "KWD", "SGD", snapshot, now), 617);
  assert.equal(convertAmount(650, "SGD", "SGD", EMPTY_RATES, now), 650);
  assert.equal(convertAmount(650, "USD", "SGD", EMPTY_RATES, now), null);
  assert.equal(
    convertAmount(650, "USD", "SGD", snapshot, now + 15 * 86400000),
    null,
  );
});
test("month ranges respect Singapore, year rollover, and daylight saving", () => {
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.deepEqual(monthBounds("2026-10", "Asia/Singapore"), {
    from: "2026-09-30T16:00:00.000Z",
    to: "2026-10-31T16:00:00.000Z",
    previous: "2026-08-31T16:00:00.000Z",
  });
  const march = monthBounds("2026-03", "America/New_York");
  assert.equal(march.from, "2026-03-01T05:00:00.000Z");
  assert.equal(march.to, "2026-04-01T04:00:00.000Z");
  assert.throws(() => fromZonedInput("2026-03-08T02:30", "America/New_York"));
  assert.throws(() => fromZonedInput("2026-02-30T12:00", "Asia/Singapore"));
});
