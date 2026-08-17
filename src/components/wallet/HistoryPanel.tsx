/**
 * What this wallet has done, newest first.
 *
 * Only this address's own transactions. Worth saying plainly, because filtering
 * the view is not privacy: every transaction on this chain is public and
 * readable by anyone from the RPC, exactly like Bitcoin or Ethereum. What this
 * panel does is show each person what concerns them.
 */
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Skeleton, cx } from '../ui';
import { formatPrts, shortAddr } from '../../lib/format';
import { useApi } from '../../lib/api';
import { useHistory, type Tx } from '../../data/history';
import { openExternal, siteUrl } from '../../lib/platform';

const COLS = 'grid grid-cols-[1fr_96px_84px] sm:grid-cols-[1fr_120px_96px] gap-3 px-3 py-3';

function when(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Row({ tx }: { tx: Tx }) {
  const inbound = tx.dir === 'in';
  const amount = tx.amount ? BigInt(tx.amount) : null;
  return (
    <button
      type="button"
      onClick={() => void openExternal(siteUrl(`/blocks/${tx.block}`))}
      title="open this block in the explorer"
      className={cx(COLS, 'w-full text-left text-[13.5px] rounded-xl hover:bg-bg-2/50 transition-colors items-center')}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span
          className={cx(
            'flex items-center justify-center w-6 h-6 rounded-full shrink-0',
            inbound ? 'bg-brand-lime/25 text-brand-lime-deep' : 'bg-black/[0.05] text-ink-soft'
          )}
        >
          {inbound ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate lowercase">{tx.kind}</span>
          {tx.peer && (
            <span className="block text-[11.5px] text-muted font-mono truncate" title={tx.peer}>
              {inbound ? 'from' : 'to'} {shortAddr(tx.peer)}
            </span>
          )}
        </span>
      </span>
      <span
        className={cx(
          'text-right tabular-nums whitespace-nowrap',
          amount !== null && inbound && 'text-brand-lime-deep'
        )}
      >
        {amount !== null ? `${inbound ? '+' : '-'}${formatPrts(amount)}` : '—'}
      </span>
      <span className="text-right text-[12px] text-muted lowercase whitespace-nowrap">
        {when(tx.ts)}
      </span>
    </button>
  );
}

export default function HistoryPanel({ address }: { address: string }) {
  const { api } = useApi();
  const { txs, loading, empty } = useHistory(address, api);

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted lowercase">
        your transactions, newest first. click one to see it in its block.
      </p>

      <div className={cx(COLS, 'text-[12px] text-muted lowercase !py-2')}>
        <span>what</span>
        <span className="text-right">prts</span>
        <span className="text-right">when</span>
      </div>

      {loading && (
        <div className="space-y-2 px-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      )}

      {!loading && empty && (
        <p className="px-3 py-10 text-center text-[13.5px] text-muted lowercase">
          nothing yet. transactions appear here within a few minutes of being confirmed.
        </p>
      )}

      {!loading &&
        txs.map((tx, i) => <Row key={`${tx.block}-${tx.hash}-${tx.dir}-${i}`} tx={tx} />)}
    </div>
  );
}
