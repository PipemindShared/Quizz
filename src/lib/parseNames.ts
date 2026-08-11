/**
 * Turns a block of names pasted out of a spreadsheet into a clean roster.
 *
 * Excel and Sheets put a tab between columns and a newline between rows, and
 * quote any cell containing a comma. Which of those means "next name" depends on
 * the shape of the selection:
 *
 *  - Several rows      -> a column of names; each row contributes its first
 *                         non-empty cell, so pasting Name/Email/Team keeps just
 *                         Name, and a selection whose first column is blank
 *                         still finds the name beside it.
 *  - A single row      -> a row of names; every tab-separated cell is a name.
 *
 * Blank cells, duplicates (ignoring case) and a leading header like "Name" are
 * dropped, so a straight copy of a spreadsheet column usually needs no editing.
 */

/** Same ceiling the team editor and Convex enforce, to keep a paste sane. */
export const MAX_MEMBERS = 200;

const HEADERS = new Set([
  "name",
  "names",
  "player",
  "players",
  "member",
  "members",
  "first name",
  "firstname",
  "full name",
  "team member",
]);

function cleanCell(cell: string): string {
  let out = cell.trim();
  // Spreadsheets wrap cells containing separators in double quotes and escape
  // inner quotes by doubling them.
  if (out.length >= 2 && out.startsWith('"') && out.endsWith('"')) {
    out = out.slice(1, -1).replace(/""/g, '"');
  }
  // Collapse runs of whitespace so "John   Smith" doesn't differ from "John Smith".
  return out.replace(/\s+/g, " ").trim();
}

export type ParsedNames = {
  names: string[];
  /** Entries dropped as blank, duplicate, header, or past the cap. */
  skipped: number;
  /** True when the cap trimmed the list. */
  truncated: boolean;
};

export function parseNames(text: string, existing: string[] = []): ParsedNames {
  const rows = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((r) => r.trim().length > 0);

  let cells: string[];
  if (rows.length > 1) {
    // A column: the first cell of each row that actually has something in it.
    // Using cell 0 blindly loses the name whenever the copied range starts with
    // an empty column.
    cells = rows.map((r) => r.split("\t").find((c) => c.trim().length > 0) ?? "");
  } else if (rows.length === 1) {
    // One row: every cell is a name. Also covers a plain single name, and
    // comma-separated text typed by hand rather than pasted.
    const only = rows[0]!;
    cells = only.includes("\t") ? only.split("\t") : only.split(/[,;]/);
  } else {
    cells = [];
  }

  const seen = new Set(existing.map((n) => n.toLowerCase()));
  const names: string[] = [];
  let skipped = 0;
  let truncated = false;

  cells.forEach((raw, index) => {
    const name = cleanCell(raw);
    if (!name) {
      skipped++;
      return;
    }
    // Only the very first cell can be a header — a later "Name" is a person.
    if (index === 0 && HEADERS.has(name.toLowerCase())) {
      skipped++;
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      return;
    }
    if (names.length + existing.length >= MAX_MEMBERS) {
      truncated = true;
      skipped++;
      return;
    }
    seen.add(key);
    names.push(name);
  });

  return { names, skipped, truncated };
}
