/**
 * csvExport.js — shared CSV building/sending helpers.
 *
 * [FIX] Extracted from vendorWalletController.js::exportMyWalletTransactions
 * and vendorReturnController.js::exportMyReturns, which each hand-rolled
 * near-identical row-joining/quote-escaping logic with NO formula-injection
 * guard: a customer name, description, or return reason starting with
 * =, +, -, @, or a tab/CR is interpreted as a live formula by Excel/Sheets
 * when the cell is opened — a well-known CSV injection vector. Every cell
 * now goes through csvCell(), which both quote-escapes and neutralizes
 * that leading-character class by prefixing a single quote.
 */

const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

// Stringifies, neutralizes formula-injection triggers, and quote-escapes a
// single CSV cell. Always wraps in quotes — simplest way to make embedded
// commas/quotes/newlines safe without per-value conditional logic.
export const csvCell = (value) => {
    let str = value === null || value === undefined ? "" : String(value);
    if (FORMULA_TRIGGER_RE.test(str)) str = `'${str}`;
    return `"${str.replace(/"/g, '""')}"`;
};

// headers: string[]; rows: array of arrays of raw (unescaped) cell values.
export const buildCsv = (headers, rows) => {
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) {
        lines.push(row.map(csvCell).join(","));
    }
    return lines.join("\n");
};

export const sendCsv = (res, filename, headers, rows) => {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buildCsv(headers, rows));
};
