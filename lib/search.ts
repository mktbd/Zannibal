/**
 * Literal, case-insensitive search helpers for admin lists (PostgREST
 * ILIKE). User input never acts as a wildcard or changes filter syntax.
 */

/** `%query%` with LIKE wildcards escaped, so a search for "50%" or "a_b" matches literally. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * PostgREST `or=(...)` filter: `query` matched literally in any of
 * `columns`. The value is double-quoted (with \\ and " escaped for
 * PostgREST) so commas, dots, parentheses or quotes in the input can't
 * change the filter's structure.
 */
export function ilikeAnyFilter(columns: readonly string[], query: string): string {
  const quoted = `"${likePattern(query).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}
