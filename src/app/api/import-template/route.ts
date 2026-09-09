import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireApiRole } from "@/lib/rbac";
import { SHEET_COLUMNS } from "@/lib/import/parse-sheet";

// A template beats documenting a format. The example rows show the one thing
// people get wrong — that a product with four sizes is four rows repeating the
// name, not one row listing them.

export async function GET() {
  const gate = await requireApiRole(["ADMIN"]);
  if (gate instanceof NextResponse) return gate;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stock");

  sheet.addRow([...SHEET_COLUMNS]);
  sheet.getRow(1).font = { bold: true };

  sheet.addRow(["Zip Hoodie", "Tees", "S", 4, "https://example.com/hoodie.jpg"]);
  sheet.addRow(["Zip Hoodie", "", "M", 6, ""]);
  sheet.addRow(["Zip Hoodie", "", "L", 2, ""]);
  sheet.addRow(["Canvas Tote", "Bags", "One size", 12, ""]);

  sheet.columns.forEach((c) => {
    c.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="stock-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
