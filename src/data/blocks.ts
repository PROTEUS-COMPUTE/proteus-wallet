/**
 * Reading one block off the chain.
 *
 * The wallet needs this to tail recent blocks for its own transactions when the
 * indexed history is behind. The explorer's list helpers are not here: nothing
 * in a wallet paginates the chain.
 */
import type { ApiPromise } from '@polkadot/api';
import type { BlockHash } from '@polkadot/types/interfaces';
import { addressOf, toRao, type Extrinsic } from '../lib/extrinsic';

export type BlockRow = {
  number: number;
  hash: string;
  parent: string;
  extrinsicCount: number;
  /** on-chain timestamp (extrinsic timestamp.set) or arrival time */
  timestamp: number;
  /** decoded transactions for the detail panel */
  exs: Extrinsic[];
};

/** decoded extrinsic, whichever way it was obtained */
type Ex = {
  method: { section: string; method: string; args: unknown[] };
  hash: { toHex(): string };
  toHuman(): unknown;
};

/**
 * Outcome and fee for each extrinsic of a block, or null when unreadable.
 *
 * These live in the block's EVENTS, which are state, and the node discards
 * state after ~256 blocks. Returning null rather than guessing matters: a
 * transaction shown as "success" on no evidence is worse than one shown as
 * unknown.
 */
async function fetchOutcomes(
  api: ApiPromise,
  hash: BlockHash
): Promise<Map<number, { ok: boolean; fee: bigint | null }> | null> {
  try {
    const at = await api.at(hash);
    const events = (await at.query.system.events()) as unknown as Array<{
      phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { toNumber(): number } };
      event: { section: string; method: string; data: Array<{ toString(): string }> };
    }>;
    const out = new Map<number, { ok: boolean; fee: bigint | null }>();
    for (const rec of events) {
      if (!rec.phase?.isApplyExtrinsic) continue;
      const i = rec.phase.asApplyExtrinsic.toNumber();
      const cur = out.get(i) ?? { ok: true, fee: null };
      const key = `${rec.event.section}.${rec.event.method}`;
      if (key === 'system.ExtrinsicFailed') cur.ok = false;
      else if (key === 'system.ExtrinsicSuccess') cur.ok = true;
      else if (/FeePaid$/.test(rec.event.method)) {
        // the amount is the last numeric field of the event across pallets
        for (const d of rec.event.data) {
          const n = toRao(d.toString());
          if (n !== null && n > 0n) cur.fee = n;
        }
      }
      out.set(i, cur);
    }
    return out;
  } catch {
    return null; // outside the pruning window: unknown, not "fine"
  }
}

/**
 * Blocks older than the pruning window, read anyway.
 *
 * The node keeps every block but discards STATE after ~256 blocks, and
 * `api.rpc.chain.getBlock` asks for the runtime version at that block in order
 * to decode it. Past that window the request fails with "state already
 * discarded" even though the block sits right there and `chain_getBlock`
 * answers fine. So the raw block is fetched and decoded with the CURRENT
 * metadata, which holds as long as the runtime keeps the same shape.
 */
async function fetchRawBlock(api: ApiPromise, hash: string) {
  const provider = (api as unknown as {
    _rpcCore: { provider: { send(method: string, params: unknown[]): Promise<unknown> } };
  })._rpcCore.provider;
  const raw = (await provider.send('chain_getBlock', [hash])) as {
    block: { header: { parentHash: string }; extrinsics: string[] };
  };
  return {
    parent: raw.block.header.parentHash,
    exs: raw.block.extrinsics.map((hex) => api.createType('Extrinsic', hex) as unknown as Ex),
  };
}

/**
 * @param withOutcomes read the events for status and fees. Costs one extra
 *   round trip per block, which the history sweep does not need since it walks
 *   dozens of blocks at a time.
 */
export async function fetchBlockAt(
  api: ApiPromise,
  n: number,
  withOutcomes = true
): Promise<BlockRow> {
  const hash = await api.rpc.chain.getBlockHash(n);
  const hex = hash.toHex();
  if (/^0x0+$/.test(hex)) throw new Error('no block at that height yet');

  let exs: Ex[];
  let parent: string;
  try {
    const signed = await api.rpc.chain.getBlock(hash);
    exs = signed.block.extrinsics as unknown as Ex[];
    parent = signed.block.header.parentHash.toHex();
  } catch {
    ({ exs, parent } = await fetchRawBlock(api, hex));
  }

  let ts = Date.now();
  for (const ex of exs) {
    if (ex.method.section === 'timestamp' && ex.method.method === 'set') {
      ts = Number(String(ex.method.args[0]));
    }
  }
  const outcomes = withOutcomes ? await fetchOutcomes(api, hash) : null;
  return {
    number: n,
    hash: hex,
    parent,
    extrinsicCount: exs.length,
    timestamp: ts,
    exs: exs.map((ex, i) => toExtrinsic(ex, outcomes?.get(i) ?? null)),
  };
}

/**
 * toHuman() shape into the flat one the panel renders. Read defensively: the
 * signer key differs between signed and unsigned extrinsics, and an unknown
 * pallet must degrade into "we show what we have", never into a crash that
 * blanks the whole block.
 */
function toExtrinsic(ex: Ex, outcome: { ok: boolean; fee: bigint | null } | null): Extrinsic {
  const h = ex.toHuman() as Record<string, unknown>;
  const m = (h.method ?? {}) as { section?: string; method?: string; args?: Record<string, unknown> };
  const signer = h.signer ?? (h.isSigned ? h.address : null);
  return {
    section: m.section ?? ex.method.section,
    method: m.method ?? ex.method.method,
    signer: addressOf(signer),
    args: m.args ?? {},
    hash: ex.hash.toHex(),
    ok: outcome?.ok ?? null,
    fee: outcome?.fee ?? null,
    json: JSON.stringify(h, null, 2),
  };
}
