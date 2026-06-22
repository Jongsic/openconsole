/**
 * Pure input-transform helpers for form fields. Extracted from inline component
 * logic (e.g. the security-group RuleEditor) so they can be unit-tested directly
 * — this is the cheapest, least-brittle place to catch our-side regressions such
 * as the NaN-port bug.
 *
 * These are pure functions: no React, no i18n, no network.
 */

export type PortRange = { from: number; to: number };

/**
 * Parse a port field into a `{from, to}` range.
 *  - ""            → null  (means "all ports" — caller omits FromPort/ToPort)
 *  - "80"          → { from: 80, to: 80 }
 *  - "8000-8010"   → { from: 8000, to: 8010 }
 *  - "  80 - 90 "  → { from: 80, to: 90 } (whitespace tolerated)
 *  - non-numeric   → throws (e.g. "abc", "80-x") so callers surface an error
 *
 * Numbers must be finite; anything that parses to NaN throws.
 */
export function parsePortRange(input: string): PortRange | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const parts = trimmed.split("-").map((s) => s.trim());
  const from = Number(parts[0]);
  const to = parts.length > 1 ? Number(parts[1]) : from;
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error("invalid-port");
  }
  return { from, to };
}

/**
 * Split a comma-separated CIDR field into a clean list: trim each entry and drop
 * empties. "10.0.0.0/8, , 0.0.0.0/0 " → ["10.0.0.0/8", "0.0.0.0/0"].
 */
export function splitCidrs(input: string): string[] {
  return input
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}
