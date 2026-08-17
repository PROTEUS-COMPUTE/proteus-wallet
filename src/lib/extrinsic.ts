/**
 * What an extrinsic looks like once decoded, and the two readers that make
 * sense of its arguments.
 *
 * These lived next to the explorer's row component in the web app. Here nothing
 * renders an extrinsic, only the history reads them, so the helpers are on
 * their own rather than dragging a whole table row into a wallet.
 */
export type Extrinsic = {
  section: string;
  method: string;
  /** who signed it, null for the ones the block author inserts itself */
  signer: string | null;
  args: Record<string, unknown>;
  hash: string;
  /** null when the block is older than the pruning window */
  ok: boolean | null;
  /** fee in rao, null when unknown or when nothing was charged */
  fee: bigint | null;
  json: string;
};

export function toRao(v: unknown): bigint | null {
  const s = String(v ?? '').replace(/[,\s]/g, '');
  if (!/^\d+$/.test(s)) return null;
  try {
    return BigInt(s);
  } catch {
    return null;
  }
}

/** an address arrives either as a string or as MultiAddress { Id: "5F…" } */
export function addressOf(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 40) return v;
  if (v && typeof v === 'object' && 'Id' in v) return String((v as { Id: unknown }).Id);
  return null;
}
