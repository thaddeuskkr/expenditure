import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { csvExport, expenseWorkbook } from "../src/lib/export.ts";
import { EMPTY_RATES, type CircleTransaction, type Expense } from "../src/lib/domain.ts";

const expense = {
    merchant: "=HYPERLINK(\"bad\")",
    amount: 850,
    currency: "SGD",
    category: "Other",
    occurred_at: "2026-09-30 16:05:30.000Z",
    notes: "line1\nline2",
    payment_method: "Visa",
    source: "api",
    kind: "expense",
    recurrence: "",
} as Expense;

test("CSV preserves cents, escapes formulas and multiline text, and uses the selected timezone", () => {
    const csv = csvExport([expense], "Asia/Singapore");
    assert.ok(csv.includes("\"'=HYPERLINK(\"\"bad\"\")\""));
    assert.ok(csv.includes("\"8.50\""));
    assert.ok(csv.includes("\"line1\nline2\""));
    assert.ok(csv.includes("\"Date & time (Asia/Singapore)\""));
    assert.ok(csv.includes("\"2026-10-01 00:05:30\""));
    assert.ok(csv.includes("\"2026-09-30T16:05:30.000Z\""));
});

test("Excel export round-trips typed amounts, sortable local dates, headers and filtering", async () => {
    const workbook = await expenseWorkbook([expense], "Asia/Singapore");
    const buffer = await workbook.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    const sheet = loaded.getWorksheet("Expenses")!;
    assert.equal(sheet.rowCount, 2);
    assert.equal(sheet.getCell("B2").type, ExcelJS.ValueType.Number);
    assert.equal(sheet.getCell("B2").value, 8.5);
    assert.equal(sheet.getCell("B2").numFmt, "#,##0.00");
    assert.equal(sheet.getCell("E2").type, ExcelJS.ValueType.Date);
    assert.equal(
        (sheet.getCell("E2").value as Date).toISOString(),
        "2026-10-01T00:05:30.000Z",
    );
    assert.equal(sheet.getCell("E1").value, "Date & time (Asia/Singapore)");
    assert.equal(sheet.getCell("I2").value, "2026-09-30T16:05:30.000Z");
    assert.equal(sheet.getCell("A2").type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell("A2").value, expense.merchant);
    assert.equal(sheet.getCell("G2").value, expense.notes);
    assert.equal(sheet.autoFilter, "A1:K2");
    assert.equal(sheet.views[0].state, "frozen");
});

test("exports follow a changed timezone across daylight-saving boundaries", async () => {
    const rows = [{ ...expense, occurred_at: "2026-11-01T06:30:00Z" }];
    const workbook = await expenseWorkbook(rows, "America/New_York");
    const date = workbook.getWorksheet("Expenses")!.getCell("E2").value as Date;
    assert.equal(date.toISOString(), "2026-11-01T01:30:00.000Z");
    assert.ok(csvExport(rows, "UTC").includes("\"2026-11-01 06:30:00\""));
});

test("mixed-currency exports keep original precision and include dated conversion estimates", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const rates = { ...EMPTY_RATES, quotes: { EUR: 1, SGD: 1.5, JPY: 150, KWD: 0.3 }, dates: { SGD: date, JPY: date, KWD: date }, fetched_at: `${date}T12:00:00Z` };
    const rows = [{ ...expense, currency: "JPY", amount: 1000 }, { ...expense, currency: "KWD", amount: 1234 }];
    const workbook = await expenseWorkbook(rows, "Asia/Singapore", "SGD", rates);
    const sheet = workbook.getWorksheet("Expenses")!;
    assert.equal(sheet.getCell("B2").value, 1000);
    assert.equal(sheet.getCell("B2").numFmt, "#,##0");
    assert.equal(sheet.getCell("B3").value, 1.234);
    assert.equal(sheet.getCell("B3").numFmt, "#,##0.000");
    assert.equal(sheet.getCell("J2").value, 10);
    assert.equal(sheet.getCell("J3").value, 6.17);
    assert.equal(sheet.getCell("L2").value, date);
    assert.ok(csvExport(rows, "Asia/Singapore", "SGD", rates).includes("\"Estimated amount (SGD)\""));
    assert.ok(csvExport(rows, "Asia/Singapore", "SGD", rates).includes("\"1.234\""));
    const missing = await expenseWorkbook(rows, "UTC", "SGD", EMPTY_RATES);
    assert.equal(missing.getWorksheet("Expenses")!.getCell("J2").value, null);
});

test("exports distinguish income from expenses without changing positive monetary values", async () => {
    const rows: Expense[] = [expense, { ...expense, kind: "income", merchant: "Salary" }];
    const workbook = await expenseWorkbook(rows, "UTC");
    const sheet = workbook.getWorksheet("Expenses")!;
    assert.equal(sheet.getCell("J1").value, "Type");
    assert.equal(sheet.getCell("J2").value, "expense");
    assert.equal(sheet.getCell("J3").value, "income");
    assert.equal(sheet.getCell("B3").value, 8.5);
    assert.ok(csvExport(rows, "UTC").includes("\"income\""));
});

test("export time formats change local display while retaining typed Excel dates and original UTC timestamps", async () => {
    const rows = [expense, { ...expense, occurred_at: "2026-10-01T04:05:30Z" }];
    const csv = csvExport(rows, "Asia/Singapore", undefined, EMPTY_RATES, "12h");
    assert.ok(csv.includes("\"2026-10-01 12:05:30 AM\""));
    assert.ok(csv.includes("\"2026-10-01 12:05:30 PM\""));
    assert.ok(csv.includes("\"2026-09-30T16:05:30.000Z\""));
    const workbook = await expenseWorkbook(rows, "Asia/Singapore", undefined, EMPTY_RATES, "12h");
    const buffer = await workbook.xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    const sheet = loaded.getWorksheet("Expenses")!;
    assert.equal(sheet.getCell("E2").type, ExcelJS.ValueType.Date);
    assert.equal(sheet.getCell("E2").numFmt, "yyyy-mm-dd h:mm:ss AM/PM");
    assert.equal((sheet.getCell("E2").value as Date).toISOString(), "2026-10-01T00:05:30.000Z");
    assert.equal((sheet.getCell("E3").value as Date).toISOString(), "2026-10-01T12:05:30.000Z");
    assert.equal(sheet.getCell("I2").value, "2026-09-30T16:05:30.000Z");
    assert.equal((await expenseWorkbook(rows, "Asia/Singapore")).getWorksheet("Expenses")!.getCell("E2").numFmt, "yyyy-mm-dd hh:mm:ss");
});

test("combined exports preserve allocated amounts, full Circle totals and provenance in CSV and Excel", async () => {
    const shared = {
        ...expense, id: "shared123456789", collectionName: "circle_expenses", title: "Shared dinner", amount: 1000, allocated_amount: 350,
        category: "Circle dining", budget_category: "Other", circle: "circle123456789", expand: { circle: { id: "circle123456789", name: "Friends", icon: "users" } },
    } as unknown as CircleTransaction;
    const rows = [expense, shared];
    const csv = csvExport(rows, "Asia/Singapore");
    assert.ok(csv.includes("\"Amount (your share)\""));
    assert.ok(csv.includes("\"Shared dinner\",\"3.50\""));
    assert.ok(csv.includes("\"circle\",\"Friends\",\"circle123456789\",\"10.00\",\"Other\""));
    const workbook = await expenseWorkbook(rows, "Asia/Singapore", "SGD");
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet = loaded.getWorksheet("Expenses")!;
    assert.equal(sheet.getCell("B3").value, 3.5);
    assert.equal(sheet.getCell("J3").value, 3.5);
    assert.equal(sheet.getCell("P3").value, "circle");
    assert.equal(sheet.getCell("Q3").value, "Friends");
    assert.equal(sheet.getCell("R3").value, "circle123456789");
    assert.equal(sheet.getCell("S3").value, 10);
    assert.equal(sheet.getCell("S3").numFmt, "#,##0.00");
    assert.equal(sheet.getCell("T3").value, "Other");
    assert.equal(sheet.getCell("P2").value, "personal");
    assert.equal(sheet.getCell("S2").value, 8.5);
    assert.equal(sheet.autoFilter, "A1:T3");
    assert.equal(sheet.getCell("I3").value, "2026-09-30T16:05:30.000Z");
});
