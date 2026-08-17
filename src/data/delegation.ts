/**
 * What delegating to the router actually pays, read off the chain.
 *
 * The router (uid 0) is the only hotkey here that receives dividends, so it is
 * the only place where delegating earns anything at all. Mining emission goes
 * to the miner's own hotkey untouched and is never shared with nominators, so
 * a miner sitting on staked rewards earns nothing on them today.
 *
 * The chain splits the router's validator emission across everything staked on
 * it, pro rata, minus the take. The rate is therefore emission over stake: it
 * falls as people delegate. Nothing here is annualised for that reason. An APY
 * computed on an almost-empty pool reads as a promise and is wrong within the
 * hour; a daily figure next to the total already delegated is not.
 *
 * Reads:
 *   subtensorModule.keys(netuid, 0)          -> the router hotkey
 *   subtensorModule.emission(netuid)         -> per-tempo emission, uid 0
 *   subtensorModule.delegates(hotkey)        -> take, out of 65535
 *   subtensorModule.totalHotkeyStake(hotkey) -> what the payout is split across
 *   subtensorModule.tempo(netuid)            -> blocks between payouts
 */

import { useEffect, useState } from 'react';
import { useApi } from '../lib/api';

const NETUID = 1;
/** the chain targets 12 s, same assumption as the epoch counter */
const BLOCK_SECONDS = 12;
const RAO = 1e9;
/** delegate takes are stored as a fraction of u16::MAX */
const TAKE_DENOM = 65535;

export type Delegation = {
  /** the router hotkey, null until read */
  hotkey: string | null;
  /** prts already staked on it, self-stake included: the payout is split across all of it */
  totalStaked: number | null;
  /** prts shared among stakers every day, after the take */
  dailyPool: number | null;
  /** prts per day that `amount` would earn, null while the chain figures are unknown */
  dailyFor: (amount: number) => number | null;
};

/**
 * A new deposit dilutes itself: it joins the pool it is paid from. Quoting the
 * current rate to someone about to move it would overstate what they get, so
 * the deposit is in the denominator here.
 *
 * At the time of writing: pool 2427 prts/day over 23264 staked, so 1000 prts
 * delegated pays 2427 * 1000 / 24264 = 100.0 prts/day, not the 104.3 the
 * headline rate suggests.
 */
export function dailyReturn(dailyPool: number, totalStaked: number, amount: number): number {
  if (amount <= 0) return 0;
  return (dailyPool * amount) / (totalStaked + amount);
}

export function useDelegation(): Delegation {
  const { api } = useApi();
  const [hotkey, setHotkey] = useState<string | null>(null);
  const [totalStaked, setTotalStaked] = useState<number | null>(null);
  const [dailyPool, setDailyPool] = useState<number | null>(null);

  useEffect(() => {
    if (!api) return;
    let alive = true;

    // cast: the custom SubtensorModule storage is not in the generated api types
    const sub = (api.query as unknown as {
      subtensorModule?: {
        keys?: (n: number, uid: number) => Promise<{ toString(): string }>;
        emission?: (n: number) => Promise<{ toJSON(): unknown }>;
        delegates?: (hk: string) => Promise<{ toString(): string }>;
        totalHotkeyStake?: (hk: string) => Promise<{ toString(): string }>;
        tempo?: (n: number) => Promise<{ toString(): string }>;
      };
    }).subtensorModule;
    if (!sub?.keys || !sub.emission || !sub.delegates || !sub.totalHotkeyStake || !sub.tempo) return;

    (async () => {
      try {
        const hk = (await sub.keys!(NETUID, 0)).toString();
        const [emission, take, stake, tempo] = await Promise.all([
          sub.emission!(NETUID).then((v) => v.toJSON() as Array<number | string>),
          sub.delegates!(hk).then((v) => Number(v.toString())),
          sub.totalHotkeyStake!(hk).then((v) => Number(v.toString())),
          sub.tempo!(NETUID).then((v) => Number(v.toString())),
        ]);
        if (!alive || !tempo) return;
        // u64 comes back as a number or a hex string depending on size; Number handles both
        const perTempo = Number(emission[0] ?? 0) / RAO;
        const payoutsPerDay = (24 * 3600) / (tempo * BLOCK_SECONDS);
        setHotkey(hk);
        setTotalStaked(stake / RAO);
        setDailyPool(perTempo * payoutsPerDay * (1 - take / TAKE_DENOM));
      } catch {
        /* leave them null: the panel then shows no figures rather than wrong ones */
      }
    })();

    return () => {
      alive = false;
    };
  }, [api]);

  return {
    hotkey,
    totalStaked,
    dailyPool,
    dailyFor: (amount) =>
      dailyPool === null || totalStaked === null ? null : dailyReturn(dailyPool, totalStaked, amount),
  };
}
