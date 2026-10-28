import {
    asDate,
    zonedInput,
    currencyDigits,
    convertAmount,
    rateDate,
    EMPTY_RATES,
    timeLabel,
    type TimeFormat,
    type ExchangeRates,
    isCircleTransaction,
    transactionName,
    transactionAmount,
    type Transaction,
} from "./domain.ts";

export type ExportFormat = "csv" | "xlsx";
type ExportOptions = {
    format: ExportFormat;
    month: string;
    currency: string;
    timezone: string;
    timeFormat: TimeFormat;
    mainCurrency?: string;
    rates?: ExchangeRates;
};
type ExportCell = string | number | Date | null;

function localSpreadsheetDate(value: string, timezone: string) {
    // Spreadsheets store dates without a timezone. Encode the chosen wall time.
    const instant = asDate(value);
    const date = new Date(`${zonedInput(instant, timezone)}:00Z`);
    date.setUTCSeconds(instant.getUTCSeconds(), instant.getUTCMilliseconds());
    return date;
}

function exportHeaders(timezone: string, mainCurrency?: string, circles = false) {
    return [
        "Merchant",
        circles ? "Amount (your share)" : "Amount",
        "Currency",
        "Category",
        `Date & time (${timezone})`,
        "Payment method",
        "Notes",
        "Source",
        "Timestamp (UTC)",
        ...(mainCurrency ?
                [
                    `Estimated amount (${mainCurrency})`,
                    "Exchange rate",
                    "Rate date",
                    "Rates fetched at",
                ] :
                []),
        "Type",
        "Recurrence",
        "Repeat interval",
        "Monthly day",
        ...(circles ? ["Ledger", "Circle", "Circle ID", "Transaction total", "Budget category"] : []),
    ];
}

function exportValues(
    expense: Transaction,
    timezone: string,
    mainCurrency?: string,
    rates = EMPTY_RATES,
    circles = false,
): ExportCell[] {
    const row: ExportCell[] = [
        transactionName(expense),
        transactionAmount(expense) / 10 ** currencyDigits(expense.currency),
        expense.currency,
        expense.category,
        localSpreadsheetDate(expense.occurred_at, timezone),
        expense.payment_method,
        expense.notes,
        expense.source,
        asDate(expense.occurred_at).toISOString(),
    ];
    const circle = isCircleTransaction(expense) ? expense : null;
    const tail: ExportCell[] = [expense.kind, expense.recurrence, expense.recurrence ? expense.recurrence_interval : null, expense.recurrence === "monthly" ? expense.recurrence_day : null, ...(circles ? [circle ? "circle" : "personal", circle?.expand.circle.name || "", circle?.circle || "", expense.amount / 10 ** currencyDigits(expense.currency), circle?.budget_category || expense.category] : [])];
    if (!mainCurrency) return [...row, ...tail];

    const convertedAmount = convertAmount(
        transactionAmount(expense),
        expense.currency,
        mainCurrency,
        rates,
    );
    const sameCurrency = expense.currency === mainCurrency;
    let exchangeRate: number | null = null;
    if (convertedAmount !== null) {
        exchangeRate = sameCurrency ?
            1 :
            rates.quotes[mainCurrency] / rates.quotes[expense.currency];
    }

    row.push(
        convertedAmount === null ?
            null :
            convertedAmount / 10 ** currencyDigits(mainCurrency),
        exchangeRate,
        sameCurrency ? "" : rateDate(expense.currency, mainCurrency, rates),
        rates.fetched_at ? asDate(rates.fetched_at).toISOString() : "",
    );
    return [...row, ...tail];
}

function csvCell(value: ExportCell, decimalPlaces?: number, timeFormat: TimeFormat = "24h") {
    let text: string;
    if (value === null) {
        text = "";
    } else if (value instanceof Date) {
        text = `${value.toISOString().slice(0, 10)} ${timeLabel(value, "UTC", timeFormat, true)}`;
    } else if (typeof value === "number" && decimalPlaces !== undefined) {
        text = value.toFixed(decimalPlaces);
    } else {
        text = String(value);
    }

    // Keep user-entered text from becoming a formula when a spreadsheet opens it.
    if (/^\s*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return "\"" + text.replaceAll("\"", "\"\"") + "\"";
}

export function csvExport(
    expenses: Transaction[],
    timezone: string,
    mainCurrency?: string,
    rates = EMPTY_RATES,
    timeFormat: TimeFormat = "24h",
) {
    const circles = expenses.some(isCircleTransaction);
    const headers = exportHeaders(timezone, mainCurrency, circles);
    const rows = [
        headers,
        ...expenses.map((expense) =>
            exportValues(expense, timezone, mainCurrency, rates, circles),
        ),
    ];
    return (
        "\uFEFF" +
        rows
            .map((row) =>
                row
                    .map((value, index) => {
                    // Amount columns use their currency precision; rates stay numeric.
                        if (index === 1 || index === headers.indexOf("Transaction total"))
                            return csvCell(value, currencyDigits(String(row[2])));
                        if (index === 9 && mainCurrency)
                            return csvCell(value, currencyDigits(mainCurrency));
                        return csvCell(value, undefined, timeFormat);
                    })
                    .join(","),
            )
            .join("\r\n")
    );
}

export async function expenseWorkbook(
    expenses: Transaction[],
    timezone: string,
    mainCurrency?: string,
    rates = EMPTY_RATES,
    timeFormat: TimeFormat = "24h",
) {
    // Keep the Excel writer out of the initial application bundle.
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Expenditure";
    const sheet = workbook.addWorksheet("Expenses", {
        views: [{ state: "frozen", ySplit: 1 }],
    });
    const widths = [30, 16, 12, 22, 34, 25, 50, 12, 30, 25, 20, 16, 30];
    const circleWidths: Record<string, number> = { Ledger: 12, Circle: 28, "Circle ID": 24, "Transaction total": 20, "Budget category": 24 };
    const circles = expenses.some(isCircleTransaction);
    sheet.columns = exportHeaders(timezone, mainCurrency, circles).map((header, index) => ({
        header,
        width: circleWidths[header] || widths[index] || 18,
    }));
    sheet.addRows(
        expenses.map((expense) =>
            exportValues(expense, timezone, mainCurrency, rates, circles),
        ),
    );
    expenses.forEach((expense, index) => {
        const digits = currencyDigits(expense.currency);
        const format = "#,##0" + (digits ? "." + "0".repeat(digits) : "");
        sheet.getCell(index + 2, 2).numFmt = format;
        if (circles) sheet.getCell(index + 2, sheet.columnCount - 1).numFmt = format;
    });
    if (mainCurrency) {
        const digits = currencyDigits(mainCurrency);
        sheet.getColumn(10).numFmt =
            "#,##0" + (digits ? "." + "0".repeat(digits) : "");
        sheet.getColumn(11).numFmt = "0.000000";
    }

    sheet.getColumn(5).numFmt = timeFormat === "12h" ? "yyyy-mm-dd h:mm:ss AM/PM" : "yyyy-mm-dd hh:mm:ss";
    sheet.autoFilter = {
        from: "A1",
        to: `${sheet.getColumn(sheet.columnCount).letter}${sheet.rowCount}`,
    };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFF0EEEA" }, size: 11 };
    sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF252B20" },
    };
    sheet.getRow(1).height = 26;
    sheet.getColumn(7).alignment = { vertical: "top", wrapText: true };
    return workbook;
}

export async function downloadExpenses(
    expenses: Transaction[],
    options: ExportOptions,
) {
    let blob: Blob;
    if (options.format === "xlsx") {
        const workbook = await expenseWorkbook(
            expenses,
            options.timezone,
            options.mainCurrency,
            options.rates,
            options.timeFormat,
        );
        const buffer = await workbook.xlsx.writeBuffer();
        blob = new Blob([new Uint8Array(buffer)], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
    } else {
        blob = new Blob(
            [
                csvExport(
                    expenses,
                    options.timezone,
                    options.mainCurrency,
                    options.rates,
                    options.timeFormat,
                ),
            ],
            {
                type: "text/csv;charset=utf-8;",
            },
        );
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `expenditure-${options.month}-${options.currency}.${options.format}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
