/** units: 1 PRTS = 10^9 rao */
export const RAO_PER_PRTS = 1_000_000_000n;
/**
 * The cap, in one place. Everything user-facing derives from it (see
 * MAX_SUPPLY_LABEL) so the figure can never disagree with itself across the
 * page -- on an explorer whose whole promise is verifiability, a number that
 * contradicts the one two tiles above is worse than no number.
 */
export const MAX_SUPPLY_PRTS = 21_000_000n;
export const MAX_SUPPLY_RAO = MAX_SUPPLY_PRTS * RAO_PER_PRTS;
export const MAX_SUPPLY_LABEL = MAX_SUPPLY_PRTS.toLocaleString('en-US');

/** genesis allocation, 5% of the cap, as stated in the whitepaper */
export const GENESIS_PCT = 5n;
export const GENESIS_RAO = (MAX_SUPPLY_RAO * GENESIS_PCT) / 100n;

/** formats a rao amount into a "x.xxxx prts" string (without the suffix) */
export function formatPrts(rao: bigint, maxDecimals = 4): string {
  const neg = rao < 0n;
  const abs = neg ? -rao : rao;
  const int = abs / RAO_PER_PRTS;
  const frac = abs % RAO_PER_PRTS;
  const intStr = int.toLocaleString('en-US');
  if (maxDecimals <= 0 || frac === 0n) return `${neg ? '-' : ''}${intStr}`;
  const fracStr = frac
    .toString()
    .padStart(9, '0')
    .slice(0, maxDecimals)
    .replace(/0+$/, '');
  return `${neg ? '-' : ''}${intStr}${fracStr ? '.' + fracStr : ''}`;
}

/**
 * Same amount, but as something parsePrts can read back: no thousands
 * separator and no truncation. Use this to fill an input, never formatPrts.
 *
 * formatPrts groups digits ("69,987") and parsePrts reads a comma as a decimal
 * point, so feeding one to the other silently divides the amount by 1000. That
 * is exactly what the max button did, and only above 1000 prts, which is why it
 * survived until a user hit it.
 */
export function formatPrtsInput(rao: bigint): string {
  return formatPrts(rao, 9).replace(/,/g, '');
}

/** grouped thousands, the way formatPrts writes them: "69,987", "1,234,567.5" */
const GROUPED = /^\d{1,3}(,\d{3})+(\.\d*)?$/;

/**
 * Parses a user input into rao, null if invalid. Accepts "1.5", "1,5" and the
 * grouped form this app displays ("69,987").
 *
 * A comma is only a decimal point when the input is not grouped. Reading
 * "69,987" as 69.987 is the kind of mistake that moves a thousand times less
 * money than intended without any error, so grouping is stripped first.
 */
export function parsePrts(input: string): bigint | null {
  const trimmed = input.trim().replace(/\s/g, '');
  const clean = GROUPED.test(trimmed)
    ? trimmed.replace(/,/g, '')
    : trimmed.replace(',', '.');
  if (!/^\d+(\.\d{0,9})?$/.test(clean)) return null;
  const [int, frac = ''] = clean.split('.');
  try {
    return BigInt(int) * RAO_PER_PRTS + BigInt(frac.padEnd(9, '0') || '0');
  } catch {
    return null;
  }
}

export function shortHash(h: string, head = 8, tail = 6): string {
  if (h.length <= head + tail + 1) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

export function shortAddr(a: string): string {
  return shortHash(a, 6, 6);
}

/** "12 s ago", "3 min ago"... from a ms timestamp */
export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
