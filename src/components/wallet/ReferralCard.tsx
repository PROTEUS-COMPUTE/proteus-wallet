/**
 * The referral link, generated where the referrer already is.
 *
 * The referrer needs a wallet anyway, since that is where the reward lands. So
 * issuing the link here costs them nothing extra and it carries the payout
 * address with it: no separate step to collect an address by hand, and no
 * chance of writing it down wrong.
 *
 * The signature does ONE job: it binds the address to the token, so whoever
 * forwards the link cannot swap in their own address and steal the credit. It
 * deliberately does NOT claim a date. A signature can be produced at any time
 * with any content, so a self-signed timestamp would just be a backdating tool.
 * Eligibility is decided against a single public start block for the whole
 * programme, which nobody can move after the fact.
 */
import { useState } from 'react';
import { Check, Copy, Gift } from 'lucide-react';
import { Button, ErrorNote, InfoNote } from '../ui';
import { copyText, siteUrl } from '../../lib/platform';
import { signMessage } from './sign';
import type { WalletAccount } from './types';

/** what gets signed. Changing this string invalidates every existing link. */
export const referralMessage = (address: string) => `PROTEUS referral v1: ${address}`;

const encodeToken = (payload: object) =>
  btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Tells the server a link was issued, so the programme can be counted.
 *
 * Everything above happens offline in the browser, which is why no count of
 * issued links existed at all: a link that is generated and never opened used
 * to leave no trace anywhere. This is the deliberate trade for that number, and
 * it does send the token, so the referrer's public address, plus whatever the
 * access log records about the request.
 *
 * Fire and forget, and every failure is swallowed: a counter must never be able
 * to break the thing it counts. keepalive so it survives the tab being closed
 * right after the click.
 */
const countIssued = (token: string) => {
  try {
    void fetch(siteUrl(`/r/gen?ref=${encodeURIComponent(token)}`), {
      method: 'GET',
      keepalive: true,
      cache: 'no-store',
    }).catch(() => {});
  } catch {
    /* counting is never worth an exception in the signing path */
  }
};

export default function ReferralCard({ account }: { account: WalletAccount }) {
  const [link, setLink] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const sig = await signMessage(account, referralMessage(account.address), password);
      const token = encodeToken({ v: 1, ref: account.address, sig });
      countIssued(token);
      // The site url, never window.location: inside the app that origin is
      // tauri://localhost, and the shared link would open nothing for anyone.
      setLink(siteUrl(`/?ref=${token}`));
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await copyText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable: the link stays selectable by hand */
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-[12.5px] text-muted lowercase">
        share this link. when someone you brought registers a miner and it earns a score, the
        reward is paid to {account.name}.
      </div>

      {account.kind === 'local' && !link && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password of this account"
          className="w-full bg-bg-2/60 rounded-xl px-3.5 py-3 text-[13px] outline-none"
        />
      )}

      {link ? (
        <>
          <div className="font-mono text-[12px] break-all bg-bg-2/60 rounded-xl px-3.5 py-3 text-ink-soft">
            {link}
          </div>
          <Button type="button" variant="ghost" onClick={copy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'copied' : 'copy the link'}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          onClick={generate}
          disabled={busy || (account.kind === 'local' && !password)}
        >
          <Gift className="w-4 h-4" />
          {busy ? 'signing...' : 'generate my referral link'}
        </Button>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <InfoNote>
        only miners registered after the programme started count, and they have to answer and be
        scored for five days. the link proves who referred, it does not reserve a place.
      </InfoNote>
    </div>
  );
}
