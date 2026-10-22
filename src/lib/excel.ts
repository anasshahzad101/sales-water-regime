import "server-only";
import ExcelJS from "exceljs";
import { pktDate } from "./time";

export type XlsxColumn<R> = {
  header: string;
  width?: number;
  value: (row: R) => string | number | Date | null | undefined;
  /** Excel number format, e.g. '#,##0' for rupees. */
  numFmt?: string;
};

/** Builds a one-sheet workbook with a branded, frozen, filterable header row. */
export async function buildXlsx<R>(sheetName: string, columns: XlsxColumn<R>[], rows: R[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WR Sales Hub";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c, i) => ({ header: c.header, key: `c${i}`, width: c.width ?? 18 }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF007A3A" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  for (const r of rows) {
    ws.addRow(Object.fromEntries(columns.map((c, i) => [`c${i}`, c.value(r) ?? null])));
  }
  columns.forEach((c, i) => {
    if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return wb.xlsx.writeBuffer();
}

export function xlsxResponse(buffer: ArrayBuffer | Buffer | Uint8Array, base: string, rowCount: number) {
  const filename = `${base}_${pktDate()}.xlsx`;
  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Row-Count": String(rowCount),
      "Cache-Control": "no-store",
    },
  });
}
