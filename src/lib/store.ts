/**
 * Where the accounts actually live on disk.
 *
 * The web wallet kept its encrypted keystores in localStorage. In a desktop app
 * that is the wrong place: localStorage belongs to the webview profile, so a
 * WebView2 reset or a reinstall takes the keys with it, and the user has no file
 * to back up. Here they go to ONE readable file in the app data directory:
 *
 *   %APPDATA%\com.proteus-agent.wallet\accounts.json
 *
 * The file is a plain array of standard polkadot keystores, still encrypted with
 * the account password. That format matters: it can be copied to a usb stick, or
 * fed one entry at a time to polkadot.js. We are not inventing a container.
 *
 * Writes go through a temporary file and a rename. A half-written accounts.json
 * is somebody's coins gone, and a crash between two writes is exactly how that
 * happens.
 */
import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import type { KeyringPair$Json } from '@polkadot/keyring/types';

export type StoredAccount = KeyringPair$Json;

const FILE = 'accounts.json';
const TMP = 'accounts.json.tmp';
const DIR = { baseDir: BaseDirectory.AppData } as const;

/** Read once at startup, then kept here: the UI reads accounts while rendering,
 *  and turning every read into a promise would touch every component for nothing. */
let cache: StoredAccount[] = [];
let loaded = false;

function isAccount(v: unknown): v is StoredAccount {
  const a = v as Partial<StoredAccount> | null;
  return !!a && typeof a.address === 'string' && typeof a.encoded === 'string';
}

/** Loads the file into memory. Call once, before rendering: everything else here
 *  assumes it ran. A missing file is the normal first launch, not an error. */
export async function loadAccounts(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    if (!(await exists(FILE, DIR))) return;
    const parsed: unknown = JSON.parse(await readTextFile(FILE, DIR));
    // Keep only what is really a keystore: one corrupt entry must not take the
    // whole file down and hide the accounts that are still fine.
    cache = Array.isArray(parsed) ? parsed.filter(isAccount) : [];
  } catch {
    // Unreadable file: show an empty wallet rather than crash, and above all do
    // NOT overwrite it. accounts.json stays on disk to be recovered by hand.
    cache = [];
  }
}

export function readAll(): StoredAccount[] {
  return cache;
}

async function persist(list: StoredAccount[]): Promise<void> {
  await mkdir('', { ...DIR, recursive: true }).catch(() => undefined);
  const body = JSON.stringify(list, null, 2);
  // temp + rename: rename is atomic on the same volume, so accounts.json holds
  // either the old content or the new one, never a truncated mix.
  await writeTextFile(TMP, body, DIR);
  await remove(FILE, DIR).catch(() => undefined); // windows refuses to rename onto an existing file
  await rename(TMP, FILE, { oldPathBaseDir: DIR.baseDir, newPathBaseDir: DIR.baseDir });
  cache = list;
}

/** Adds an account, replacing any entry with the same address. */
export async function addAccount(json: StoredAccount): Promise<void> {
  await persist([...cache.filter((a) => a.address !== json.address), json]);
}

export async function removeAccount(address: string): Promise<void> {
  await persist(cache.filter((a) => a.address !== address));
}
