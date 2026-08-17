/**
 * Every account in this app is a local keystore. The web version also had
 * `kind: 'extension'` for polkadot.js and friends; a webview has no extensions,
 * so that branch is gone rather than kept as an option that can never be taken.
 */
export type WalletAccount = {
  address: string;
  name: string;
  kind: 'local';
};
