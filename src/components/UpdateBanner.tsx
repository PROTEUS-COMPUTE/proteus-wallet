import { useEffect, useState } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { Button } from './ui';

/**
 * A banner, never a silent install.
 *
 * Ported from the miner app, with one difference that matters here: this window
 * holds keys. An update that restarts the app on its own, while somebody is
 * halfway through writing down a recovery phrase, loses that phrase for good.
 * So the user decides when, always.
 *
 * Failure is silent on purpose. No network, a github blip or an unreadable
 * manifest must never look like a problem with the wallet itself: the installed
 * version keeps working and the banner simply does not appear.
 */
type State =
  | { kind: 'idle' }
  | { kind: 'found'; update: Update }
  | { kind: 'downloading'; pct: number | null }
  | { kind: 'ready' }
  | { kind: 'failed'; why: string };

export default function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    void check()
      .then((u) => u && setState({ kind: 'found', update: u }))
      .catch(() => undefined);
  }, []);

  async function install(update: Update) {
    setState({ kind: 'downloading', pct: null });
    try {
      // contentLength is optional in the manifest, so this has to survive not
      // knowing the total and fall back to a plain "downloading".
      let total = 0;
      let got = 0;
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') total = e.data.contentLength ?? 0;
        if (e.event === 'Progress') {
          got += e.data.chunkLength;
          setState({ kind: 'downloading', pct: total > 0 ? Math.round((got / total) * 100) : null });
        }
        if (e.event === 'Finished') setState({ kind: 'ready' });
      });
      setState({ kind: 'ready' });
    } catch (e) {
      setState({ kind: 'failed', why: String(e) });
    }
  }

  if (state.kind === 'idle') return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-brand-lime/[0.14] border-b border-brand-lime/30">
      {state.kind === 'found' && (
        <>
          <span className="text-[13px] lowercase text-ink-soft">
            version {state.update.version} is available. your accounts stay where they are.
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setState({ kind: 'idle' })}>
              later
            </Button>
            <Button onClick={() => void install(state.update)}>update</Button>
          </div>
        </>
      )}

      {state.kind === 'downloading' && (
        <span className="text-[13px] lowercase text-ink-soft">
          downloading update{state.pct !== null ? ` ${state.pct}%` : '…'}
        </span>
      )}

      {state.kind === 'ready' && (
        <>
          <span className="text-[13px] lowercase text-ink-soft">
            update installed. restart to finish.
          </span>
          <Button onClick={() => void relaunch()}>restart</Button>
        </>
      )}

      {state.kind === 'failed' && (
        <>
          <span className="text-[13px] lowercase text-ink-soft">
            update failed, this version keeps working. {state.why}
          </span>
          <Button variant="ghost" onClick={() => setState({ kind: 'idle' })}>
            dismiss
          </Button>
        </>
      )}
    </div>
  );
}
