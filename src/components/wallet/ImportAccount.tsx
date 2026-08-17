import { useState, type FormEvent } from 'react';
import { Button, ErrorNote, Input, Label, Textarea, cx } from '../ui';
import { importFromJson, importFromMnemonic } from '../../lib/wallet';

type Props = {
  onDone: () => void;
};

type Mode = 'mnemonic' | 'json';

export default function ImportAccount({ onDone }: Props) {
  const [mode, setMode] = useState<Mode>('mnemonic');
  const [name, setName] = useState('');
  const [phrase, setPhrase] = useState('');
  const [json, setJson] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'mnemonic') {
        if (password.length < 6) throw new Error('the password must be at least 6 characters');
        await importFromMnemonic(name.trim() || 'imported account', phrase, password);
      } else {
        await importFromJson(json, password);
      }
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        /passphrase|decode/i.test(msg)
          ? 'wrong password for this keystore'
          : msg || 'the import failed, check the details'
      );
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setJson(await file.text());
    } catch {
      setError('could not read this file');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="inline-flex rounded-full border border-black/[0.07] bg-white p-1">
        {(['mnemonic', 'json'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cx(
              'px-4 py-1.5 text-[13px] lowercase rounded-full transition-colors',
              mode === m ? 'bg-ink text-white' : 'text-muted hover:text-ink'
            )}
          >
            {m === 'mnemonic' ? 'mnemonic phrase' : 'keystore json'}
          </button>
        ))}
      </div>

      {mode === 'mnemonic' ? (
        <>
          {/* People coming from the desktop miner look for a button that says
              "windows client" and conclude the import does not exist. It does:
              the client generates a plain 12-word sr25519 phrase and this page
              derives it the same way, ss58 format 42 on both sides, so the
              address that comes back is byte-for-byte the one they mine with.
              Nothing to build, only to name. */}
          <p className="text-[12.5px] text-muted lowercase">
            mining with the windows client? its 12-word phrase goes here, and you
            get back the exact same address you mine with.
          </p>
          <div>
            <Label>account name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="imported account" />
          </div>
          <div>
            <Label>12 or 24 word phrase</Label>
            <Textarea
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              rows={3}
              placeholder="word1 word2 word3 …"
              required
            />
          </div>
          <div>
            <Label>new password (encrypts the local keystore)</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label>keystore json file</Label>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-[13.5px] text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-ink file:text-white file:px-4 file:py-2 file:text-[13px] file:lowercase file:cursor-pointer"
            />
          </div>
          <div>
            <Label>or paste the json content</Label>
            <Textarea
              value={json}
              onChange={(e) => setJson(e.target.value)}
              rows={4}
              placeholder='{"encoded":"…","address":"…"}'
            />
          </div>
          <div>
            <Label>keystore password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" disabled={busy || (mode === 'json' && !json)}>
        {busy ? 'importing…' : 'import the account'}
      </Button>
    </form>
  );
}
