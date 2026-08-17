import { useState, type FormEvent } from 'react';
import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { ISubmittableResult } from '@polkadot/types/types';
import { Button, ErrorNote, Input, Label } from '../ui';
import { isValidAddress, listStored, unlockPair } from '../../lib/wallet';
import { formatPrts, parsePrts } from '../../lib/format';
import TxReceipt from './TxReceipt';
import type { WalletAccount } from './types';

type Props = {
  api: ApiPromise;
  from: WalletAccount;
  balance: bigint | null;
  onClose: () => void;
};

type TransferFn = (dest: string, value: bigint) => SubmittableExtrinsic<'promise'>;

export default function SendForm({ api, from, balance, onClose }: Props) {
  const [dest, setDest] = useState('');
  const [amount, setAmount] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ txHash: string; blockNumber: number | null } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(null);

    if (!isValidAddress(dest.trim())) {
      setError('the recipient address is not valid');
      return;
    }
    const rao = parsePrts(amount);
    if (rao === null || rao <= 0n) {
      setError('invalid amount (e.g. 1.5)');
      return;
    }
    if (balance !== null && rao > balance) {
      setError('amount higher than the available balance');
      return;
    }

    /* transferKeepAlive if available in the metadata, otherwise transferAllowDeath, otherwise transfer */
    const balancesTx = api.tx.balances as unknown as Record<string, TransferFn | undefined>;
    const transfer =
      balancesTx.transferKeepAlive ?? balancesTx.transferAllowDeath ?? balancesTx.transfer;
    if (!transfer) {
      setError('no transfer extrinsic available in the runtime');
      return;
    }

    setBusy(true);
    let unsub: (() => void) | undefined;

    // built before the callback so the receipt can quote its hash: this is the
    // only identifier the sender can keep, the chain has no txid lookup.
    const tx = transfer(dest.trim(), rao);

    const callback = (result: ISubmittableResult) => {
      if (result.dispatchError) {
        let msg = result.dispatchError.toString();
        if (result.dispatchError.isModule) {
          const meta = api.registry.findMetaError(result.dispatchError.asModule);
          msg = `${meta.section}.${meta.name}`;
        }
        setError(`transfer rejected by the chain: ${msg}`);
        setProgress(null);
        setBusy(false);
        unsub?.();
      } else if (result.status.isInBlock) {
        // the status carries the block HASH; the number is what makes the
        // transaction findable again, so it is fetched right after.
        setDone({ txHash: tx.hash.toHex(), blockNumber: null });
        void api.rpc.chain
          .getHeader(result.status.asInBlock)
          .then((h) => setDone((d) => (d ? { ...d, blockNumber: h.number.toNumber() } : d)))
          .catch(() => undefined);
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
      setError(msg || 'sending failed, try again');
      setProgress(null);
      setBusy(false);
    }
  };

  if (done) {
    return <TxReceipt what="transfer" txHash={done.txHash} blockNumber={done.blockNumber} onClose={onClose} />;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>recipient (ss58 address)</Label>
        <Input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder="5F…"
          required
          className="font-mono text-[13.5px]"
        />
      </div>
      <div>
        <Label>amount (prts)</Label>
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1.5"
          inputMode="decimal"
          required
        />
        {balance !== null && (
          <p className="text-[12.5px] text-muted lowercase mt-1.5">
            available: {formatPrts(balance)} prts
          </p>
        )}
      </div>
      {from.kind === 'local' && (
        <div>
          <Label>account password</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
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
          {busy ? 'sending…' : 'sign and send'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          cancel
        </Button>
      </div>
    </form>
  );
}
