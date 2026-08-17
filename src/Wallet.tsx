import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ChevronDown, Clock, Coins, Gift, Plus, QrCode, Send, Trash2, Wallet as WalletIcon } from 'lucide-react';
import SectionHead from './components/SectionHead';
import { Badge, Button, Card, InfoNote, Skeleton, cx } from './components/ui';
import CreateAccount from './components/wallet/CreateAccount';
import ImportAccount from './components/wallet/ImportAccount';
import ReceivePanel from './components/wallet/ReceivePanel';
import ReferralCard from './components/wallet/ReferralCard';
import ReferredByCard from './components/wallet/ReferredByCard';
import SendForm from './components/wallet/SendForm';
import StakeForm from './components/wallet/StakeForm';
import HistoryPanel from './components/wallet/HistoryPanel';
import type { WalletAccount } from './components/wallet/types';
import { useApi } from './lib/api';
import { formatPrts, shortAddr } from './lib/format';
import { confirmDialog } from './lib/platform';
import { accountName, listStored, removeStored } from './lib/wallet';

/* The actions this wallet actually has. There is no swap: PROTEUS has no DEX,
   so the tabs are the real operations, not a trading UI. */
type Tab = 'send' | 'receive' | 'stake' | 'activity' | 'refer';
type Sheet = 'create' | 'import' | null;

const TABS: Array<{ id: Tab; label: string; icon: typeof Send }> = [
  { id: 'send', label: 'send', icon: Send },
  { id: 'receive', label: 'receive', icon: QrCode },
  { id: 'stake', label: 'stake', icon: Coins },
  { id: 'activity', label: 'activity', icon: Clock },
  { id: 'refer', label: 'refer', icon: Gift },
];

export default function Wallet() {
  const { api, status } = useApi();

  const [storedVersion, setStoredVersion] = useState(0);
  const localAccounts = useMemo<WalletAccount[]>(
    () =>
      listStored().map((j) => ({
        address: j.address,
        name: accountName(j),
        kind: 'local' as const,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedVersion]
  );

  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [balances, setBalances] = useState<Map<string, bigint>>(new Map());
  const [stakes, setStakes] = useState<Map<string, bigint>>(new Map());
  const [tab, setTab] = useState<Tab>('send');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  /* No browser extension here: a webview has none, so web3Enable would always
     come back empty and the "connect an extension" door would be a dead end.
     Every account in this app is a keystore in accounts.json. */
  const allAccounts = localAccounts;
  const selected = allAccounts.find((a) => a.address === selectedAddr) ?? null;

  /* default selection of the first available account */
  useEffect(() => {
    if (!selected && allAccounts.length > 0) setSelectedAddr(allAccounts[0].address);
    if (allAccounts.length === 0) setSelectedAddr(null);
  }, [allAccounts, selected]);

  /* close the account picker on outside click / Escape */
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPickerOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  /* live balances of all listed accounts */
  const addrKey = allAccounts.map((a) => a.address).join(',');
  useEffect(() => {
    if (!api || !addrKey) return;
    let alive = true;
    let unsub: (() => void) | undefined;
    const addrs = addrKey.split(',');

    api.query.system.account
      .multi(addrs, (infos) => {
        if (!alive) return;
        const next = new Map<string, bigint>();
        addrs.forEach((a, i) => {
          const info = infos[i] as unknown as { data: { free: { toBigInt(): bigint } } };
          next.set(a, info.data.free.toBigInt());
        });
        setBalances(next);
      })
      .then((u) => {
        unsub = u;
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      unsub?.();
    };
  }, [api, addrKey]);

  /* live mining rewards: a coldkey's total stake across its hotkeys (that's where
     mining emission lands, not the free balance). */
  useEffect(() => {
    if (!api || !addrKey) return;
    let alive = true;
    let unsub: (() => void) | undefined;
    const addrs = addrKey.split(',');
    // cast: SubtensorModule storage isn't in the generated api types
    const store = (api.query as unknown as {
      subtensorModule?: {
        totalColdkeyStake: {
          multi: (a: string[], cb: (v: Array<{ toBigInt(): bigint }>) => void) => Promise<() => void>;
        };
      };
    }).subtensorModule?.totalColdkeyStake;
    if (!store) return;

    store
      .multi(addrs, (vals) => {
        if (!alive) return;
        const next = new Map<string, bigint>();
        addrs.forEach((a, i) => next.set(a, vals[i]?.toBigInt() ?? 0n));
        setStakes(next);
      })
      .then((u) => {
        unsub = u;
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      unsub?.();
    };
  }, [api, addrKey]);

  /* Deleting an account deletes the only copy of a key on this machine, so the
     confirmation has to be a real one. window.confirm is a no-op in a webview:
     it would have deleted without ever asking. */
  const deleteLocal = async (addr: string) => {
    const ok = await confirmDialog(
      'remove this account from this computer? you will only be able to get it back with its recovery phrase or its keystore file.'
    );
    if (!ok) return;
    await removeStored(addr);
    setStoredVersion((v) => v + 1);
    if (selectedAddr === addr) setSelectedAddr(null);
  };

  const balanceOf = (addr: string): bigint | null => balances.get(addr) ?? null;
  const stakeOf = (addr: string): bigint => stakes.get(addr) ?? 0n;

  const free = selected ? balanceOf(selected.address) : null;
  const staked = selected ? stakeOf(selected.address) : 0n;

  /* ---------- pieces ---------- */

  const AccountPill = () => (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setPickerOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full bg-ink text-white pl-3 pr-2.5 py-2 text-[13.5px] lowercase font-medium hover:bg-black transition-colors max-w-[190px]"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-brand-lime shrink-0" />
        <span className="truncate">{selected ? selected.name : 'select an account'}</span>
        <ChevronDown className={cx('w-3.5 h-3.5 shrink-0 transition-transform', pickerOpen && 'rotate-180')} />
      </button>

      {pickerOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[300px] rounded-[12px] border border-white/70 bg-white/80 backdrop-blur-2xl shadow-[0_1px_2px_rgba(20,20,40,0.04),0_18px_50px_-20px_rgba(20,20,60,0.3)] p-2">
          {allAccounts.length === 0 && (
            <p className="text-[12.5px] text-muted lowercase px-2 py-3">no account yet.</p>
          )}
          {allAccounts.map((a) => (
            <div
              key={a.address}
              className={cx(
                'flex items-center gap-2 rounded-[8px] px-2.5 py-2 transition-colors',
                selectedAddr === a.address ? 'bg-brand-lime/20' : 'hover:bg-black/[0.04]'
              )}
            >
              <button
                className="flex-1 text-left min-w-0"
                onClick={() => {
                  setSelectedAddr(a.address);
                  setPickerOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] lowercase truncate">{a.name}</span>
                  <Badge tone="neutral">local</Badge>
                </div>
                <div className="text-[11.5px] text-muted font-mono">{shortAddr(a.address)}</div>
              </button>
              <div className="text-right leading-tight shrink-0">
                <div className="text-[12px] text-ink-soft tabular-nums">
                  {balanceOf(a.address) !== null ? formatPrts(balanceOf(a.address)!) : '-'}
                </div>
                {stakeOf(a.address) > 0n && (
                  <div className="text-[10.5px] text-brand-lime-deep tabular-nums">
                    +{formatPrts(stakeOf(a.address))}
                  </div>
                )}
              </div>
              {a.kind === 'local' && (
                <button
                  onClick={() => void deleteLocal(a.address)}
                  className="w-6 h-6 grid place-items-center rounded-full text-muted hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  aria-label="remove account"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}

          <div className="border-t border-black/[0.06] mt-2 pt-2 flex flex-col gap-1">
            <button
              onClick={() => {
                setSheet('create');
                setPickerOpen(false);
              }}
              className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] lowercase text-ink-soft hover:bg-black/[0.04] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              create an account
            </button>
            <button
              onClick={() => {
                setSheet('import');
                setPickerOpen(false);
              }}
              className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] lowercase text-ink-soft hover:bg-black/[0.04] transition-colors"
            >
              <WalletIcon className="w-3.5 h-3.5" />
              import an account
            </button>
          </div>
        </div>
      )}
    </div>
  );

  /* the two pockets, stacked like a swap card: what you can spend, and what
     mining paid you. The arrow between them is what unstaking actually does. */
  const Pockets = () => (
    <>
      <div className="rounded-[12px] border border-white/60 bg-white/35 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[12.5px] text-muted lowercase">available balance</span>
          <AccountPill />
        </div>
        {free !== null ? (
          <div className="font-display font-light text-[38px] tabular-nums leading-tight mt-1">
            {formatPrts(free)} <span className="text-[18px] text-muted">prts</span>
          </div>
        ) : status === 'deconnecte' ? (
          <div className="font-display font-light text-[38px] text-muted mt-1">-</div>
        ) : (
          <Skeleton className="h-10 w-44 mt-2" />
        )}
        {selected && (
          <div className="font-mono text-[11.5px] text-faint break-all mt-1.5">{selected.address}</div>
        )}
      </div>

      <div className="relative h-0 flex justify-center">
        <div className="-mt-3.5 w-8 h-8 grid place-items-center rounded-[10px] border border-white/70 bg-white/70 backdrop-blur-xl text-ink-soft z-10">
          <ArrowDown className="w-4 h-4" />
        </div>
      </div>

      <div className="rounded-[12px] border border-brand-lime/35 bg-brand-lime/[0.07] p-4 mt-1.5">
        <span className="text-[12.5px] text-muted lowercase">mining rewards · staked</span>
        <div className="font-display font-light text-[28px] tabular-nums leading-tight mt-0.5 text-brand-lime-deep">
          {formatPrts(staked)} <span className="text-[15px] text-muted">prts</span>
        </div>
        <p className="text-[12px] text-muted lowercase mt-1">
          earned by your gpu, held as stake. unstake to move it up to your available balance.
        </p>
      </div>
    </>
  );

  return (
    <div>
      <SectionHead eyebrow="wallet · non-custodial" title="your $prts wallet">
        your keys stay on this computer, in an encrypted keystore only your password opens.
        nothing ever goes through a server.
      </SectionHead>

      <div className="mt-9 mx-auto w-full max-w-[480px]">
        <Card className="p-2">
          {/* tabs: the real operations, no swap.
              Five of them need 429px of labels while the card is 358px wide even
              on a 390px phone, so the row used to push the page past the screen.
              Below 520px only the icons remain; the active tab keeps its label so
              the user still knows where he is. The threshold is measured, not
              guessed: at 380px the labels came back and the page blew up again. */}
          {/* gap-0.5 and not gap-1 since the sixth tab: six labelled pills need
              520px inside a card that is 462px at ANY viewport, the card being
              max-width bound. Adding `api` made the last pill hang 49px outside
              its own card. Measured 2026-08-16, not guessed, same as the
              breakpoint below. */}
          <div className="flex items-center gap-0.5 p-1">
            {TABS.map((t) => {
              const active = tab === t.id && sheet === null;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id);
                    setSheet(null);
                  }}
                  aria-label={t.label}
                  className={cx(
                    'inline-flex items-center justify-center gap-1 rounded-full px-2.5 min-[520px]:px-2 py-1.5 text-[13.5px] lowercase transition-colors shrink-0',
                    active ? 'bg-ink text-white font-medium' : 'text-muted hover:text-ink'
                  )}
                >
                  <t.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className={cx(active ? 'inline' : 'hidden min-[520px]:inline')}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-2 pt-1 space-y-1.5">
            {sheet !== null ? (
              <div className="px-2 pb-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-light text-[18px] lowercase">
                    {sheet === 'create' ? 'create an account' : 'import an account'}
                  </h2>
                  <button
                    onClick={() => setSheet(null)}
                    className="text-[12.5px] text-muted hover:text-ink lowercase transition-colors"
                  >
                    cancel
                  </button>
                </div>
                {sheet === 'create' ? (
                  <CreateAccount
                    onDone={() => {
                      setStoredVersion((v) => v + 1);
                      setSheet(null);
                    }}
                  />
                ) : (
                  <ImportAccount
                    onDone={() => {
                      setStoredVersion((v) => v + 1);
                      setSheet(null);
                    }}
                  />
                )}
              </div>
            ) : allAccounts.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-lime shadow-[0_0_0_5px_rgba(159,255,0,0.18)] animate-pulse mb-4" />
                <p className="font-display font-light text-[20px] lowercase">no account yet</p>
                <p className="text-[13px] text-muted lowercase mt-2 max-w-[44ch] mx-auto">
                  create an account on this computer, or import the recovery phrase the windows
                  miner gave you.
                </p>
                {/* "import" has to be reachable FROM HERE. It used to live only in
                    the account picker, which is inside Pockets, which only renders
                    once an account exists: someone arriving with a phrase from the
                    desktop miner had to first create an account they did not want.
                    The import worked all along, there was simply no door into it. */}
                <div className="flex flex-wrap justify-center gap-2.5 mt-5">
                  <Button onClick={() => setSheet('create')}>
                    <Plus className="w-4 h-4" />
                    create account
                  </Button>
                  <Button variant="ghost" onClick={() => setSheet('import')}>
                    <WalletIcon className="w-4 h-4" />
                    import
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Pockets />

                <div className="px-2 pt-4 pb-2">
                  {!api ? (
                    <InfoNote>rpc unreachable for now, reconnecting…</InfoNote>
                  ) : tab === 'send' && selected ? (
                    <SendForm api={api} from={selected} balance={free} onClose={() => setTab('send')} />
                  ) : tab === 'receive' && selected ? (
                    <ReceivePanel account={selected} />
                  ) : tab === 'stake' && selected ? (
                    <StakeForm api={api} from={selected} balance={free} onClose={() => setTab('send')} />
                  ) : tab === 'activity' && selected ? (
                    <HistoryPanel address={selected.address} />
                  ) : tab === 'refer' && selected ? (
                    <div className="space-y-7">
                      <ReferralCard account={selected} />
                      <div className="border-t border-black/[0.06] pt-6">
                        <ReferredByCard account={selected} />
                      </div>
                    </div>
                  ) : (
                    <InfoNote>select an account first.</InfoNote>
                  )}
                </div>

                {status === 'deconnecte' && (
                  <InfoNote>
                    rpc unreachable: balance and sending will be back as soon as it reconnects.
                  </InfoNote>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
