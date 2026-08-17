/**
 * The transactions of one address, index plus live tail.
 *
 * The chain cannot answer "what did this address do": a node stores blocks, not
 * an index from address to transactions. A cron reads the blocks and writes one
 * file per address, so a wallet downloads only its own history.
 *
 * But an index built every 15 minutes means a transfer takes up to 15 minutes to
 * show up, and nobody accepts that in a wallet. So the blocks the index has not
 * reached yet are read straight from the RPC and merged on top. The index covers
 * the deep history, the live read covers the last minutes.
 */
import { useEffect, useState } from 'react';
import { siteUrl } from '../lib/platform';
import type { ApiPromise } from '@polkadot/api';
import { fetchBlockAt } from './blocks';
import { addressOf, toRao } from '../lib/extrinsic';

export type Tx = {
  block: number;
  /** ms since epoch, from the block's own timestamp extrinsic */
  ts: number | null;
  hash: string | null;
  /** "transfer", "stake", "unstake"… already readable */
  kind: string;
  /** rao as a string: a transfer can exceed Number.MAX_SAFE_INTEGER */
  amount: string | null;
  dir: 'in' | 'out';
  /** the other side, when the call has one */
  peer: string | null;
};

export type History = {
  txs: Tx[];
  loading: boolean;
  /** true once we know this address simply has no history yet */
  empty: boolean;
};

/** never scan more than this live, however far behind the index is */
const MAX_LIVE_BLOCKS = 400;

async function readJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    // Caddy answers index.html with a 200 for a missing path, so an address with
    // no history returns the whole app as "JSON". The parse is the real test.
    const text = await r.text();
    const first = text.trimStart()[0];
    if (!r.ok || (first !== '[' && first !== '{')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Blocks the cron has not indexed yet, read live.
 *
 * Only the calls that concern this address are kept, and only what the wallet
 * displays is extracted: the same shape the index produces, so both merge
 * without the panel knowing where a row came from.
 */
async function liveTail(api: ApiPromise, address: string, fromBlock: number): Promise<Tx[]> {
  const head = (await api.rpc.chain.getHeader()).number.toNumber();
  const start = Math.max(fromBlock + 1, head - MAX_LIVE_BLOCKS + 1);
  if (start > head) return [];

  const nums: number[] = [];
  for (let n = head; n >= start; n--) nums.push(n);

  const out: Tx[] = [];
  // par lots: 400 requetes en parallele noieraient le RPC
  for (let i = 0; i < nums.length; i += 20) {
    const rows = await Promise.all(
      nums.slice(i, i + 20).map((n) => fetchBlockAt(api, n, false).catch(() => null))
    );
    for (const row of rows) {
      if (!row) continue;
      for (const ex of row.exs) {
        if (!ex.signer) continue;
        const peer = addressOf(ex.args.dest ?? ex.args.hotkey ?? ex.args.to);
        const mine = ex.signer === address;
        const toMe = peer === address;
        if (!mine && !toMe) continue;
        const amount = toRao(ex.args.value ?? ex.args.amount_staked ?? ex.args.amount_unstaked);
        out.push({
          block: row.number,
          ts: row.timestamp,
          hash: ex.hash,
          kind: ex.section === 'balances' ? 'transfer' : ex.method.replace(/([A-Z])/g, ' $1').toLowerCase(),
          amount: amount !== null ? amount.toString() : null,
          dir: mine ? 'out' : 'in',
          peer: mine ? peer : ex.signer,
        });
      }
    }
  }
  return out;
}

export function useHistory(address: string | null, api: ApiPromise | null): History {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    if (!address) {
      setTxs([]);
      setEmpty(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setEmpty(false);

    (async () => {
      const indexed = ((await readJson(siteUrl(`/tx/${address}.json`))) as Tx[] | null) ?? [];
      if (!alive) return;
      // show the index straight away, the live read lands after
      setTxs(indexed);
      setEmpty(indexed.length === 0);
      setLoading(false);

      if (!api) return;
      const state = (await readJson(siteUrl('/tx/_state.json'))) as { last_block?: number } | null;
      const from = typeof state?.last_block === 'number' ? state.last_block : 0;
      const live = await liveTail(api, address, from).catch(() => [] as Tx[]);
      if (!alive || live.length === 0) return;

      setTxs((prev) => {
        const seen = new Set(prev.map((t) => `${t.block}|${t.hash}|${t.dir}`));
        const merged = [...prev];
        for (const t of live) {
          if (!seen.has(`${t.block}|${t.hash}|${t.dir}`)) merged.push(t);
        }
        merged.sort((a, b) => b.block - a.block);
        return merged;
      });
      setEmpty(false);
    })();

    return () => {
      alive = false;
    };
  }, [address, api]);

  return { txs, loading, empty };
}
