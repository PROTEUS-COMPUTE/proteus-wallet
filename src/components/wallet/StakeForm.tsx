import { useEffect, useState, type FormEvent } from 'react';
import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { ISubmittableResult } from '@polkadot/types/types';
import { Button, ErrorNote, Input, Label, cx } from '../ui';
import { isValidAddress, listStored, unlockPair } from '../../lib/wallet';
import { formatPrts, formatPrtsInput, parsePrts, shortAddr } from '../../lib/format';
import { openExternal } from '../../lib/platform';
import { useDelegation } from '../../data/delegation';
import TxReceipt from './TxReceipt';
import type { WalletAccount } from './types';

type Props = {
  api: ApiPromise;
  from: WalletAccount;
  balance: bigint | null; // free balance (max when staking)
  onClose: () => void;
};

type Mode = 'unstake' | 'stake';
type StakeTx = (hotkey: string, amount: bigint) => SubmittableExtrinsic<'promise'>;

/* The loyalty ladder: days -> weight on the daily bonus pool, and the on-chain
   lock length in blocks (12 s/block). Locking uses add_stake_locked, which the
   chain refuses to unstake before the unlock block. `d: 0` is the flexible path
   (plain add_stake, unstake any time). Kept in sync with loyalty.py. */
const BLOCKS_PER_DAY = 7200; // 86400 / 12
const LOCK_TIERS = [
  { d: 0, w: 'flexible', blocks: 0 },
  { d: 3, w: '1.10x', blocks: 3 * BLOCKS_PER_DAY },
  { d: 7, w: '1.25x', blocks: 7 * BLOCKS_PER_DAY },
  { d: 10, w: '1.40x', blocks: 10 * BLOCKS_PER_DAY },
  { d: 20, w: '1.70x', blocks: 20 * BLOCKS_PER_DAY },
  { d: 50, w: '2.20x', blocks: 50 * BLOCKS_PER_DAY },
];
/* The wallet never stakes flexibly: every stake through this UI locks for a chosen
   duration, including "move to the router" (Joseph: "quand on stake, on bloque").
   Plain add_stake still exists in the runtime, it is just not reachable from here. */
const LOCK_CHOICES = LOCK_TIERS.filter((t) => t.d > 0);
const MIN_LOCK_DAYS = LOCK_CHOICES[0].d;
const blocksForDays = (days: number): bigint =>
  BigInt(LOCK_CHOICES.find((t) => t.d === days)?.blocks ?? LOCK_CHOICES[0].blocks);

export default function StakeForm({ api, from, balance, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('unstake');
  const [staked, setStaked] = useState<Array<{ hotkey: string; amount: bigint }>>([]);
  const [hotkey, setHotkey] = useState('');
  const [amount, setAmount] = useState('');
  const [lockDays, setLockDays] = useState(MIN_LOCK_DAYS); // stake mode always locks
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ txHash: string; blockNumber: number | null } | null>(null);
  // what the receipt should say: a plain stake/unstake, or a one-click delegate
  const [receiptKind, setReceiptKind] = useState<string>('stake');

  /* the coldkey's staked hotkeys + amounts (that's where mining rewards sit) */
  useEffect(() => {
    let alive = true;
    const sub = (api.query as unknown as {
      subtensorModule?: {
        stakingHotkeys: (ck: string) => Promise<{ toJSON(): unknown }>;
        stake: (hk: string, ck: string) => Promise<{ toBigInt(): bigint }>;
      };
    }).subtensorModule;
    if (!sub) return;
    (async () => {
      try {
        const hks = ((await sub.stakingHotkeys(from.address)).toJSON() as string[]) || [];
        const amounts = await Promise.all(hks.map((hk) => sub.stake(hk, from.address).then((v) => v.toBigInt())));
        if (!alive) return;
        const list = hks
          .map((hk, i) => ({ hotkey: hk, amount: amounts[i] }))
          .filter((x) => x.amount > 0n);
        setStaked(list);
        setHotkey((cur) => cur || list[0]?.hotkey || '');
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, from.address]);

  const stakedOn = (hk: string): bigint => staked.find((s) => s.hotkey === hk)?.amount ?? 0n;
  const max = mode === 'unstake' ? stakedOn(hotkey) : balance ?? 0n;

  /* what the amount being typed would earn if it went to the router */
  const delegation = useDelegation();
  const wanted = mode === 'stake' ? Number(parsePrts(amount) ?? 0n) / 1e9 : 0;
  const perDay = wanted > 0 ? delegation.dailyFor(wanted) : null;

  /* mining rewards sit on the miner's own hotkey, where they earn nothing. most
     people never open the stake tab, so the figure has to be here too. */
  const idle =
    mode === 'unstake' && hotkey && hotkey !== delegation.hotkey ? Number(stakedOn(hotkey)) / 1e9 : 0;
  const idlePerDay = idle > 0 ? delegation.dailyFor(idle) : null;

  /* Sign and send one extrinsic. Extracted so the one-click "move to router"
     can reuse it: the batch is just another tx. */
  const run = async (tx: SubmittableExtrinsic<'promise'>, receiptKind: string) => {
    setBusy(true);
    let unsub: (() => void) | undefined;
    const callback = (result: ISubmittableResult) => {
      if (result.dispatchError) {
        let msg = result.dispatchError.toString();
        if (result.dispatchError.isModule) {
          const meta = api.registry.findMetaError(result.dispatchError.asModule);
          msg = `${meta.section}.${meta.name}`;
        }
        setError(`rejected by the chain: ${msg}`);
        setProgress(null);
        setBusy(false);
        unsub?.();
      } else if (result.status.isInBlock) {
        setDone({ txHash: tx.hash.toHex(), blockNumber: null });
        void api.rpc.chain
          .getHeader(result.status.asInBlock)
          .then((h) => setDone((d) => (d ? { ...d, blockNumber: h.number.toNumber() } : d)))
          .catch(() => undefined);
        setReceiptKind(receiptKind);
        setProgress(null);
        setBusy(false);
        unsub?.();
      } else if (result.status.isBroadcast) {
        setProgress('broadcasting the transaction…');
      }
    };
    try {
      const json = listStored().find((a) => a.address === from.address);
      if (!json) throw new Error('keystore not found on this computer');
      setProgress('unlocking the account…');
      const pair = await unlockPair(json, password).catch(() => {
        throw new Error('wrong password');
      });
      setProgress('signing and sending…');
      unsub = await tx.signAndSend(pair, callback);
      setProgress((p) => p ?? 'transaction sent…');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || 'transaction failed, try again');
      setProgress(null);
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);

    const hk = hotkey.trim();
    if (!isValidAddress(hk)) {
      setError('invalid hotkey address');
      return;
    }
    const rao = parsePrts(amount);
    if (rao === null || rao <= 0n) {
      setError('invalid amount (e.g. 1.5)');
      return;
    }
    if (rao > max) {
      setError(mode === 'unstake' ? 'amount higher than the staked balance' : 'amount higher than the available balance');
      return;
    }

    const stakeTx = api.tx.subtensorModule as unknown as {
      removeStake?: StakeTx;
      addStake?: StakeTx;
      addStakeLocked?: (hotkey: string, amount: bigint, lockBlocks: bigint) => SubmittableExtrinsic<'promise'>;
    };
    let tx: SubmittableExtrinsic<'promise'> | undefined;
    if (mode === 'unstake') {
      tx = stakeTx.removeStake?.(hk, rao);
    } else if (lockDays > 0) {
      const blocks = BigInt(LOCK_TIERS.find((t) => t.d === lockDays)?.blocks ?? 0);
      tx = stakeTx.addStakeLocked?.(hk, rao, blocks);
    } else {
      tx = stakeTx.addStake?.(hk, rao);
    }
    if (!tx) {
      setError('staking extrinsic not available in the runtime');
      return;
    }
    await run(tx, mode === 'stake' && lockDays > 0 ? 'lock' : mode);
  };

  /* The whole reason a miner's rewards sit idle: to earn, they have to leave
     their own hotkey and land on the router, and the chain has no move_stake, so
     it is remove then add, two signatures, and most people stop after the first.
     batchAll runs both in one signature and rolls back entirely if either fails,
     so the funds can never end up unstaked-but-not-delegated. */
  const moveToRouter = async () => {
    setError(null);
    setDone(null);
    const router = delegation.hotkey;
    const amountRao = stakedOn(hotkey);
    if (!router || hotkey === router || amountRao <= 0n) return;
    const stakeTx = api.tx.subtensorModule as unknown as {
      removeStake?: StakeTx;
      addStakeLocked?: (hotkey: string, amount: bigint, lockBlocks: bigint) => SubmittableExtrinsic<'promise'>;
    };
    const remove = stakeTx.removeStake?.(hotkey, amountRao);
    // moving dormant rewards is staking too, so it locks for the chosen term
    const add = stakeTx.addStakeLocked?.(router, amountRao, blocksForDays(lockDays));
    if (!remove || !add) {
      setError('staking extrinsic not available in the runtime');
      return;
    }
    await run(api.tx.utility.batchAll([remove, add]), 'lock');
  };

  if (done) {
    return <TxReceipt what={receiptKind} txHash={done.txHash} blockNumber={done.blockNumber} onClose={onClose} />;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="inline-flex rounded-full border border-black/[0.08] p-0.5 text-[13px]">
        {(['unstake', 'stake'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setAmount('');
              setLockDays(MIN_LOCK_DAYS); // both the stake tab and the move button lock
              // stake mode targets the router (the only hotkey that pays); unstake
              // targets the miner's own hotkey where the rewards sit.
              setHotkey(m === 'stake' ? (delegation.hotkey ?? '') : (staked[0]?.hotkey ?? ''));
            }}
            className={cx('px-4 py-1.5 rounded-full lowercase transition-colors', mode === m ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink')}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'unstake' ? (
        <div className="space-y-1.5">
          <p className="text-[12.5px] text-muted lowercase">
            move your mining rewards from stake to your spendable balance.
          </p>
          {idlePerDay !== null && (
            <div className="rounded-[12px] border border-brand-lime/35 bg-brand-lime/[0.07] p-3.5 space-y-2.5">
              <p className="text-[12.5px] text-muted lowercase">
                they earn nothing where they sit. on the router they would pay about{' '}
                <span className="text-brand-lime-deep tabular-nums">{idlePerDay.toFixed(2)} prts</span>{' '}
                a day. move them over and lock for a loyalty share.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {LOCK_CHOICES.map((t) => (
                  <button
                    key={t.d}
                    type="button"
                    onClick={() => setLockDays(t.d)}
                    className={cx(
                      'rounded-full px-2.5 py-1 text-[11.5px] tabular-nums lowercase transition-colors',
                      lockDays === t.d ? 'bg-ink text-white' : 'bg-white/60 text-ink-soft hover:text-ink'
                    )}
                  >
                    {`${t.d}d · ${t.w}`}
                  </button>
                ))}
              </div>
              <Button type="button" onClick={moveToRouter} disabled={busy}>
                {busy ? 'signing…' : `move & lock for ${lockDays} days`}
              </Button>
              <p className="text-[11.5px] text-faint lowercase">
                one signature. unstakes from your hotkey and delegates to the router, locked for
                {' '}{lockDays} days then returned to your balance on its own, and rolls back
                entirely if anything fails.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[12px] border border-brand-lime/35 bg-brand-lime/[0.07] p-3.5 space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] lowercase">delegate to the router</span>
            {perDay !== null && (
              <span className="text-[13px] text-brand-lime-deep tabular-nums lowercase">
                ~{perDay.toFixed(2)} prts/day · {((perDay / wanted) * 100).toFixed(1)} %
              </span>
            )}
          </div>

          {/* staking through the wallet always locks; a longer lock earns more */}
          <p className="text-[12px] lowercase">lock your stake, longer earns more</p>
          <div className="flex flex-wrap gap-1.5">
            {LOCK_CHOICES.map((t) => (
              <button
                key={t.d}
                type="button"
                onClick={() => setLockDays(t.d)}
                className={cx(
                  'rounded-full px-2.5 py-1 text-[11.5px] tabular-nums lowercase transition-colors',
                  lockDays === t.d ? 'bg-ink text-white' : 'bg-white/60 text-ink-soft hover:text-ink'
                )}
              >
                {`${t.d}d · ${t.w}`}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-faint lowercase">
            {`locked ${lockDays} days, then it returns to your balance on its own. enforced by the chain, never held by us.`}{' '}
            first payout at the next epoch.{' '}
            <button
              type="button"
              onClick={() => void openExternal('https://proteus-agent.com/docs/#staking')}
              className="text-brand-lime-deep underline decoration-brand-lime/40 underline-offset-2 hover:decoration-brand-lime-deep"
            >
              guide
            </button>
          </p>

          {delegation.hotkey && hotkey !== delegation.hotkey && (
            <Button type="button" variant="ghost" onClick={() => setHotkey(delegation.hotkey!)}>
              use the router hotkey
            </Button>
          )}
        </div>
      )}

      <div>
        <Label>hotkey</Label>
        {mode === 'unstake' && staked.length > 0 ? (
          <select
            value={hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2.5 text-[13.5px] font-mono"
          >
            {staked.map((s) => (
              <option key={s.hotkey} value={s.hotkey}>
                {shortAddr(s.hotkey)} — {formatPrts(s.amount)} prts
              </option>
            ))}
          </select>
        ) : (
          <Input
            value={hotkey}
            onChange={(e) => setHotkey(e.target.value)}
            placeholder="5F… (your miner hotkey)"
            required
            className="font-mono text-[13.5px]"
          />
        )}
      </div>

      <div>
        <Label>amount (prts)</Label>
        <div className="flex gap-2">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1.5" inputMode="decimal" required />
          <Button type="button" variant="ghost" onClick={() => setAmount(formatPrtsInput(max))}>max</Button>
        </div>
        <p className="text-[12.5px] text-muted lowercase mt-1.5">
          {mode === 'unstake' ? 'staked' : 'available'}: {formatPrts(max)} prts
        </p>
      </div>

      {from.kind === 'local' && (
        <div>
          <Label>account password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      )}

      {progress && (
        <p className="text-[13.5px] text-ink-soft lowercase flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-lime-deep animate-pulse" />
          {progress}
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="flex gap-2.5">
        <Button type="submit" disabled={busy}>
          {busy ? 'signing…' : mode === 'stake' && lockDays > 0 ? `lock for ${lockDays} days` : `sign and ${mode}`}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>cancel</Button>
      </div>
    </form>
  );
}
