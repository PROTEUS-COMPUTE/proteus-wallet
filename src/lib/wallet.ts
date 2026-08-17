import { Keyring } from '@polkadot/keyring';
import type { KeyringPair } from '@polkadot/keyring/types';
import {
  cryptoWaitReady,
  mnemonicGenerate,
  mnemonicValidate,
  decodeAddress,
} from '@polkadot/util-crypto';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { addAccount, readAll, removeAccount, type StoredAccount } from './store';

/**
 * non-custodial wallet.
 * storage: only password-encrypted json keystores, in a file on this machine
 * (see store.ts). the seed is NEVER persisted in clear text, and never leaves
 * this process: no server, no telemetry, no network call carries it.
 */

export const SS58_FORMAT = 42;
export type { StoredAccount };

let readyPromise: Promise<boolean> | null = null;
function cryptoReady(): Promise<boolean> {
  if (!readyPromise) readyPromise = cryptoWaitReady();
  return readyPromise;
}

function newKeyring(): Keyring {
  return new Keyring({ type: 'sr25519', ss58Format: SS58_FORMAT });
}

export function listStored(): StoredAccount[] {
  return readAll();
}

export function removeStored(address: string): Promise<void> {
  return removeAccount(address);
}

export function accountName(json: StoredAccount): string {
  const n = (json.meta as { name?: unknown } | undefined)?.name;
  return typeof n === 'string' && n ? n : 'local account';
}

/** creates an sr25519 account, returns the mnemonic (to show ONCE) + the stored keystore */
export async function createAccount(
  name: string,
  password: string
): Promise<{ mnemonic: string; json: StoredAccount }> {
  await cryptoReady();
  const mnemonic = mnemonicGenerate(12);
  const pair = newKeyring().addFromUri(mnemonic, { name });
  const json = pair.toJson(password);
  await addAccount(json);
  return { mnemonic, json };
}

export async function importFromMnemonic(
  name: string,
  mnemonic: string,
  password: string
): Promise<StoredAccount> {
  await cryptoReady();
  const phrase = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!mnemonicValidate(phrase)) {
    throw new Error('invalid mnemonic phrase (12 or 24 words expected)');
  }
  const pair = newKeyring().addFromUri(phrase, { name });
  const json = pair.toJson(password);
  await addAccount(json);
  return json;
}

export async function importFromJson(raw: string, password: string): Promise<StoredAccount> {
  await cryptoReady();
  let json: StoredAccount;
  try {
    json = JSON.parse(raw) as StoredAccount;
  } catch {
    throw new Error('unreadable json file');
  }
  if (!json || typeof json.address !== 'string' || typeof json.encoded !== 'string') {
    throw new Error('invalid keystore (missing address/encoded fields)');
  }
  const pair = newKeyring().createFromJson(json);
  pair.unlock(password); // throws an error if the password is wrong
  pair.lock();
  await addAccount(json);
  return json;
}

/** unlocks a pair to sign locally (throws if the password is wrong) */
export async function unlockPair(json: StoredAccount, password: string): Promise<KeyringPair> {
  await cryptoReady();
  const pair = newKeyring().createFromJson(json);
  pair.unlock(password);
  return pair;
}

export function isValidAddress(addr: string): boolean {
  try {
    decodeAddress(addr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves the encrypted keystore wherever the user wants it.
 *
 * The web version built a Blob and clicked an <a download>. A webview does not
 * honour that, so the button would have looked like it worked and written
 * nothing: the one backup path in the whole app, silently broken. Here the OS
 * save dialog picks the path and the rust side writes it, which is what lets
 * the filesystem permission stay pinned to the app data directory.
 *
 * Returns the chosen path, or null if the user cancelled, so the caller can say
 * which one it is instead of claiming success either way.
 */
export async function saveKeystore(json: StoredAccount): Promise<string | null> {
  const path = await save({
    defaultPath: `proteus-${json.address.slice(0, 8)}.json`,
    filters: [{ name: 'keystore', extensions: ['json'] }],
  });
  if (!path) return null;
  await invoke('write_backup', { path, contents: JSON.stringify(json, null, 2) });
  return path;
}
