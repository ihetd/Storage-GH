import ExcelJS from "exceljs";

// Reading a stock sheet into rows, before anything touches the database.
//
// Kept free of Prisma so it can be exercised directly, and so a malformed sheet
// is rejected whole rather than half-imported. Nothing here writes.
//
// One row per size. Rows sharing a product name belong to the same product, so
// a four-size product is four rows repeating the name — which is how people
// actually type these, rather than one row with sizes crammed into a cell.

export type SheetRow = {
  /** 1-based row number in the sheet, so an error can name where to look. */
  row: number;
  product: string;
  category: string;
  label: string;
  quantity: number;
  imageUrl: string | null;
};

export type ParsedSheet = {
  rows: SheetRow[];
  errors: string[];
};

export const SHEET_COLUMNS = ["Product", "Category", "Size", "Quantity", "Image URL"] as const;

/** Header matching is forgiving: case, spaces and underscores are ignored. */
function headerKey(text: string): string {
  return text.trim().toLowerCase().replace(/[\s_]+/g, "");
}

const HEADER_ALIASES: Record<string, keyof Omit<SheetRow, "row">> = {
  product: "product",
  productname: "product",
  name: "product",
  category: "category",
  size: "label",
  variant: "label",
  label: "label",
  quantity: "quantity",
  qty: "quantity",
  count: "quantity",
  imageurl: "imageUrl",
  image: "imageUrl",
  photo: "imageUrl",
  photourl: "imageUrl",
};

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    // Excel hands back hyperlinks, formulas and rich text as objects.
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink.trim();
    if ("result" in value) return String(value.result ?? "").trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim();
    }
    return "";
  }
  return String(value).trim();
}

export async function parseStockSheet(
  buffer: ArrayBuffer,
  filename: string,
): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();

  try {
    if (filename.toLowerCase().endsWith(".csv")) {
      const text = new TextDecoder().decode(buffer);
      const { Readable } = await import("node:stream");
      await workbook.csv.read(Readable.from([text]));
    } else {
      await workbook.xlsx.load(buffer);
    }
  } catch {
    return { rows: [], errors: ["That file could not be read as a spreadsheet."] };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) {
    return { rows: [], errors: ["The file has no sheets, or the first sheet is empty."] };
  }

  const columnFor = new Map<number, keyof Omit<SheetRow, "row">>();
  sheet.getRow(1).eachCell((cell, col) => {
    const mapped = HEADER_ALIASES[headerKey(cellText(cell.value))];
    if (mapped) columnFor.set(col, mapped);
  });

  const found = new Set(columnFor.values());
  const missing = (["product", "label", "quantity"] as const).filter((k) => !found.has(k));
  if (missing.length > 0) {
    const names = { product: "Product", label: "Size", quantity: "Quantity" };
    return {
      rows: [],
      errors: [
        `The first row must name the columns. Missing: ${missing
          .map((m) => names[m])
          .join(", ")}. Expected: ${SHEET_COLUMNS.join(", ")}.`,
      ],
    };
  }

  const rows: SheetRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let n = 2; n <= sheet.rowCount; n += 1) {
    const raw = sheet.getRow(n);
    const values: Record<string, string> = {};
    for (const [col, key] of columnFor) values[key] = cellText(raw.getCell(col).value);

    // Blank lines part-way down a sheet are normal, not an error.
    if (!values.product && !values.label && !values.quantity) continue;

    if (!values.product) {
      errors.push(`Row ${n}: no product name.`);
      continue;
    }
    if (!values.label) {
      errors.push(`Row ${n}: "${values.product}" has no size.`);
      continue;
    }

    const quantity = Number(values.quantity);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) {
      errors.push(
        `Row ${n}: "${values.product} ${values.label}" has quantity "${values.quantity}", which is not a whole number of items.`,
      );
      continue;
    }

    // Two rows for one size of one product would silently keep whichever came
    // last. Refusing beats picking.
    const key = `${values.product.toLowerCase()} ${values.label.toLowerCase()}`;
    if (seen.has(key)) {
      errors.push(`Row ${n}: "${values.product} ${values.label}" appears more than once.`);
      continue;
    }
    seen.add(key);

    const imageUrl = values.imageUrl || "";
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      errors.push(`Row ${n}: image link must start with http:// or https://.`);
      continue;
    }

    rows.push({
      row: n,
      product: values.product,
      category: values.category || "",
      label: values.label,
      quantity,
      imageUrl: imageUrl || null,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("The sheet has a header but no rows of stock.");
  }

  return { rows, errors };
}

export type ProductGroup = {
  name: string;
  category: string;
  imageUrl: string | null;
  variants: { label: string; quantity: number }[];
};

/** Collapse rows into one entry per product, keeping the order they appear in. */
export function groupRows(rows: SheetRow[]): ProductGroup[] {
  const byName = new Map<string, ProductGroup>();
  for (const r of rows) {
    const key = r.product.toLowerCase();
    let group = byName.get(key);
    if (!group) {
      group = { name: r.product, category: r.category, imageUrl: r.imageUrl, variants: [] };
      byName.set(key, group);
    }
    // Category and photo come from the first row that names them, so later
    // rows for the same product need not repeat them.
    if (!group.category && r.category) group.category = r.category;
    if (!group.imageUrl && r.imageUrl) group.imageUrl = r.imageUrl;
    group.variants.push({ label: r.label, quantity: r.quantity });
  }
  return [...byName.values()];
}
