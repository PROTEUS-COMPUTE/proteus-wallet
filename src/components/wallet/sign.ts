/**
 * Sign a plain message with a local account.
 *
 * The web version also had an extension branch. Here there is one kind of
 * account, so there is one path: unlock the keystore with the password, sign,
 * and never keep the unlocked pair around.
 */
import { u8aToHex } from '@polkadot/util';
import { unlockPair, listStored } from '../../lib/wallet';
import type { WalletAccount } from './types';

export async function signMessage(
  account: WalletAccount,
  message: string,
  password: string
): Promise<string> {
  const json = listStored().find((j) => j.address === account.address);
  if (!json) throw new Error('account not found on this device');
  const pair = await unlockPair(json, password).catch(() => {
    throw new Error('wrong password');
  });
  // u8aToHex and not Buffer: Buffer is a node global, absent from the bundle
  return u8aToHex(pair.sign(message));
}
