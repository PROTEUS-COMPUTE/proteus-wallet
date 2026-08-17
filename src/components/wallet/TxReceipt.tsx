/**
 * What someone needs to prove a transaction happened.
 *
 * A Substrate node stores blocks, not an index from hash to transaction, so
 * there is no "look up this txid" endpoint to point people at. The block number
 * is therefore what lets anyone find the transaction again in the explorer, and
 * the extrinsic hash is what identifies it inside that block. Both are shown,
 * both are copyable, because a receipt you cannot copy is not a receipt.
 */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, InfoNote } from '../ui';
import { copyText } from '../../lib/platform';

type Props = {
  /** "transfer", "stake", "unstake" */
  what: string;
  /** hash of the extrinsic, the closest thing this chain has to a txid */
  txHash: string;
  /** null while the header is still being read; the hash alone is not findable */
  blockNumber: number | null;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await copyText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the value stays selectable by hand */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[11.5px] text-muted lowercase">{label}</div>
        <div className="font-mono text-[12.5px] break-all leading-snug">{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        title={`copy the ${label}`}
        className="shrink-0 p-1.5 rounded-md text-ink-soft hover:text-ink hover:bg-black/[0.04] transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function TxReceipt({ what, txHash, blockNumber, onClose }: Props) {
  return (
    <div className="space-y-4">
      <InfoNote>
        {what} confirmed{blockNumber !== null ? ` in block ${blockNumber.toLocaleString('en-US')}` : ''}
      </InfoNote>

      <div className="rounded-[12px] border border-black/[0.08] px-3.5 py-1">
        <Row label="transaction hash" value={txHash} />
        {blockNumber !== null && <Row label="block" value={String(blockNumber)} />}
      </div>

      <p className="text-[11.5px] text-muted lowercase">
        keep these to prove the transaction. the block number is what finds it again
        in the explorer.
      </p>

      <Button type="button" onClick={onClose}>close</Button>
    </div>
  );
}
