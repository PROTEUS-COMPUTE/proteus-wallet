import { useState, type FormEvent } from 'react';
import { Download, Copy, Check, Cpu } from 'lucide-react';
import { Button, ErrorNote, InfoNote, Input, Label } from '../ui';
import { copyText } from '../../lib/platform';
import {
  createAccount,
  saveKeystore,
  type StoredAccount,
} from '../../lib/wallet';

const REGEN_CMD = 'btcli wallet regen_coldkey --wallet.name miner';

type Props = {
  onDone: () => void;
};

export default function CreateAccount({ onDone }: Props) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ mnemonic: string; json: StoredAccount } | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);

  /* Says where the file landed. This is the user's backup: "it worked" is not
     enough, they have to be able to go and find it. */
  const saveBackup = async (json: StoredAccount) => {
    try {
      const path = await saveKeystore(json);
      if (path) setSavedTo(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not write the keystore file');
    }
  };

  const copyCmd = async () => {
    try {
      await copyText(REGEN_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('the password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('the two passwords do not match');
      return;
    }
    setBusy(true);
    try {
      setResult(await createAccount(name.trim() || 'proteus account', password));
    } catch {
      setError('could not create the account, try again');
    } finally {
      setBusy(false);
    }
  };

  /* step 2: the phrase is shown ONLY once */
  if (result) {
    return (
      <div className="space-y-4">
        <InfoNote>
          write these 12 words down on paper and keep them somewhere safe. this phrase is the only
          way to recover your account. it will never be shown again, and no one can recover it
          for you.
        </InfoNote>

        <div className="rounded-[14px] border border-brand-lime-deep/40 bg-brand-lime/10 p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            {result.mnemonic.split(' ').map((w, i) => (
              <span key={i} className="text-[14.5px] font-mono">
                <span className="text-muted mr-1.5 tabular-nums">{i + 1}.</span>
                {w}
              </span>
            ))}
          </div>
        </div>

        <div className="text-[13px] text-muted lowercase break-all">
          address: <span className="font-mono text-ink-soft">{result.json.address}</span>
        </div>

        <div className="rounded-[14px] border border-black/10 bg-black/[0.02] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-ink-soft" />
            <span className="text-[14px] font-medium lowercase">use this account in your miner</span>
          </div>
          <p className="text-[13px] text-muted leading-relaxed">
            this same account can be your miner's coldkey, the address where $prts rewards land. on
            your mining machine, run this command and paste the 12 words above when prompted:
          </p>
          <div className="flex items-center gap-2 rounded-[10px] border border-black/10 bg-black/[0.04] px-3 py-2.5">
            <code className="flex-1 text-[13px] font-mono text-ink-soft break-all">{REGEN_CMD}</code>
            <button
              type="button"
              onClick={copyCmd}
              aria-label="copy command"
              className="text-muted hover:text-ink transition-colors flex-none"
            >
              {copied ? (
                <Check className="w-4 h-4 text-brand-lime-deep" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[12px] text-muted leading-relaxed">
            security: this coldkey holds your funds. only put it on a machine you trust. for a
            hardened setup, use it once to register, then keep only the hotkey on the server.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button variant="ghost" type="button" onClick={() => void saveBackup(result.json)}>
            <Download className="w-4 h-4" />
            save the encrypted keystore
          </Button>
          <Button type="button" onClick={onDone}>i saved my phrase</Button>
        </div>
        {savedTo && (
          <p className="text-[12px] text-muted lowercase break-all">saved to {savedTo}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>account name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my proteus account"
          maxLength={40}
        />
      </div>
      <div>
        <Label>password (encrypts the local keystore)</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="at least 6 characters"
          required
        />
      </div>
      <div>
        <Label>confirm the password</Label>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <InfoNote>
        the seed is never stored in clear text: only a keystore encrypted with your password is
        kept in this browser.
      </InfoNote>
      <Button type="submit" disabled={busy}>
        {busy ? 'generating…' : 'generate the account (sr25519)'}
      </Button>
    </form>
  );
}
