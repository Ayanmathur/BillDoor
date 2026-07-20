/**
 * BillDoor — DB ↔ Code Field Mapping
 * 
 * §12: snake_case in the DB, camelCase in code.
 * These utilities convert between the two so no component
 * ever touches a snake_case field name directly.
 */

// ============================================================
// snake_case → camelCase
// ============================================================
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// ============================================================
// camelCase → snake_case
// ============================================================
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// ============================================================
// Convert a DB row object (snake_case keys) → code object (camelCase keys)
// ============================================================
export function fromDb<T extends Record<string, unknown>>(
  row: Record<string, unknown>
): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = snakeToCamel(key);
    // Recursively convert nested objects (like jsonb fields)
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[camelKey] = fromDb(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Date)
          ? fromDb(item as Record<string, unknown>)
          : item
      );
    } else {
      result[camelKey] = value;
    }
  }
  return result as T;
}

// ============================================================
// Convert a code object (camelCase keys) → DB row (snake_case keys)
// ============================================================
export function toDb(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    // JSONB fields stay as-is (the DB stores them as JSON objects)
    // We don't convert keys inside jsonb — Supabase handles that natively
    result[snakeKey] = value;
  }
  return result;
}

// ============================================================
// Convert an array of DB rows
// ============================================================
export function fromDbRows<T extends Record<string, unknown>>(
  rows: Record<string, unknown>[]
): T[] {
  return rows.map((row) => fromDb<T>(row));
}
