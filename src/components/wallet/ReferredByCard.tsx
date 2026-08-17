/**
 * "Someone brought me here." Declared by the REFEREE, signed by the referee.
 *
 * This is what makes a referral payable, and it exists because the two earlier
 * attempts did not work. The link alone lost the pair the moment the page
 * loaded. Sending the pair from the miner's pod works, but only for a pod
 * deployed after the provider template gains a new field, which is a manual
 * edit on Vast and RunPod that no deploy can perform, and it does nothing for
 * the miners already running.
 *
 * Here nothing outside is needed. The account that signs is the same coldkey
 * that owns the miner (it is the address pasted as PROTEUS_OWNER), so the
 * server resolves it to every hotkey it owns and applies the usual conditions.
 * That is also why this repairs the past: an operator who registered a week ago
 * can declare today, without touching their machine.
 *
 * The referrer can never do this in the referee's place. Every eligible hotkey
 * is public, so a channel where referrers name referees would let anyone claim
 * strangers; here the only person who can speak is the one who gains nothing.
 */
import { useState } from 'react';
import { Check, HeartHandshake } from 'lucide-react';
import { Button, ErrorNote, InfoNote } from '../ui';
import { siteUrl } from '../../lib/platform';
import { refAddress, referredByMessage, storedRef } from '../../lib/referral';
import { shortAddr } from '../../lib/format';
import { signMessage } from './sign';
import type { WalletAccount } from './types';

export default function ReferredByCard({ account }: { account: WalletAccount }) {
  const [token, setToken] = useState(storedRef() ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const referrer = refAddress(token);
  const self = referrer === account.address;

  const declare = async () => {
    if (!referrer) return;
    setBusy(true);
    setError(null);
    try {
      const sig = await signMessage(account, referredByMessage(referrer), password);
      const clean = token.includes('ref=') ? token.split('ref=')[1].split('&')[0] : token.trim();
      const q = new URLSearchParams({ ref: clean, by: account.address, sig });
      const res = await fetch(siteUrl(`/r/bind?${q}`), { cache: 'no-store' });
      // 204 exactly, not res.ok. The SPA fallback answers 200 with the whole
      // index.html for any unknown path, so `ok` would report success from a
      // server that has no such endpoint and recorded nothing.
      if (res.status !== 204) throw new Error(`the server answered ${res.status}, not recorded`);
      setDone(true);
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <InfoNote>
        recorded. {shortAddr(referrer ?? '')} is credited as your referrer. nothing else to do:
        the bounty is checked against your miner's age and score, and paid once it qualifies.
      </InfoNote>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-[12.5px] text-muted lowercase">
        someone brought you to proteus? paste their link here. it credits them, it costs you
        nothing, and it changes nothing to what you earn.
      </div>

      <input
        value={token}
        onChange={(e) => {
          setToken(e.target.value);
          setError(null);
        }}
        placeholder="paste the link you were given"
        className="w-full bg-bg-2/60 rounded-xl px-3.5 py-3 text-[13px] outline-none font-mono break-all"
      />

      {token && !referrer && (
        <ErrorNote>this link is not readable. copy it again, whole.</ErrorNote>
      )}

      {referrer && !self && (
        <div className="text-[12.5px] text-ink-soft lowercase">
          you are about to credit{' '}
          <span className="font-mono text-ink normal-case">{shortAddr(referrer)}</span>
        </div>
      )}

      {/* Caught here rather than by the server alone, because being told "not
          paid" a week later, with no reason given, is how a rule turns into a
          suspicion of cheating. */}
      {self && <ErrorNote>this is your own link. a referral needs two people.</ErrorNote>}

      {account.kind === 'local' && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password of this account"
          className="w-full bg-bg-2/60 rounded-xl px-3.5 py-3 text-[13px] outline-none"
        />
      )}

      <Button
        type="button"
        onClick={declare}
        disabled={busy || !referrer || self || (account.kind === 'local' && !password)}
      >
        {busy ? <Check className="w-4 h-4" /> : <HeartHandshake className="w-4 h-4" />}
        {busy ? 'signing...' : 'credit this person'}
      </Button>

      {error && <ErrorNote>{error}</ErrorNote>}

      <InfoNote>
        you can declare this at any time, including for a miner that has been running for days.
        only the first declaration counts, so a referrer cannot be swapped afterwards.
      </InfoNote>
    </div>
  );
}
