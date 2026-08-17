/* The accounts file, checked against a real directory.

   Run after touching store.ts:
     npx esbuild src/lib/store.ts --format=esm --bundle \
       --alias:@tauri-apps/plugin-fs=./src/lib/fs-stub.mjs --outfile=src/lib/store.mjs \
       && node src/lib/store.check.mjs && rm src/lib/store.mjs

   The stub is the plugin's API on top of node:fs, so what runs here is the real
   store code against a real filesystem. What is being checked is the property
   that matters: accounts.json is never left half written, because half a
   keystore is an account nobody can open again. */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proteus-store-'));
process.env.PROTEUS_STORE_DIR = dir;

const { loadAccounts, readAll, addAccount, removeAccount } = await import('./store.mjs');

const acct = (address) => ({
  address,
  encoded: 'not-a-real-key',
  encoding: { content: ['pkcs8', 'sr25519'], type: ['scrypt', 'xsalsa20-poly1305'], version: '3' },
  meta: { name: address.toLowerCase() },
});

// 1. a first launch has no file and must not be an error
await loadAccounts();
assert.deepEqual(readAll(), [], 'a missing accounts file should read as no accounts');

// 2. what is added is on disk, and readable as a plain array of keystores
await addAccount(acct('AAA'));
await addAccount(acct('BBB'));
const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8'));
assert.equal(onDisk.length, 2, 'both accounts should be in the file');
assert.deepEqual(
  onDisk.map((a) => a.address).sort(),
  ['AAA', 'BBB'],
  'the file should hold exactly what was added'
);

// 3. adding the same address again replaces it instead of duplicating
await addAccount({ ...acct('AAA'), meta: { name: 'renamed' } });
assert.equal(readAll().length, 2, 'the same address must not be stored twice');
assert.equal(readAll().find((a) => a.address === 'AAA').meta.name, 'renamed');

// 4. removing one keeps the other
await removeAccount('AAA');
assert.deepEqual(readAll().map((a) => a.address), ['BBB'], 'removing took the wrong account');

// 5. no temporary file survives a normal write: a leftover .tmp next to the
//    real file is what a half-finished write looks like from the outside
assert.deepEqual(
  fs.readdirSync(dir).sort(),
  ['accounts.json'],
  'a temporary file was left behind'
);

// 6. a corrupt file must not take the readable accounts down with it, and must
//    NOT be overwritten: it is the only copy of whatever is still in there
fs.writeFileSync(path.join(dir, 'accounts.json'), '{ this is not json');
const before = fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8');
const fresh = await import(`./store.mjs?reload=${Date.now()}`);
await fresh.loadAccounts();
assert.deepEqual(fresh.readAll(), [], 'a corrupt file should read as no accounts');
assert.equal(
  fs.readFileSync(path.join(dir, 'accounts.json'), 'utf8'),
  before,
  'a corrupt accounts file must be left alone, never rewritten'
);

fs.rmSync(dir, { recursive: true, force: true });
console.log('accounts file ok');
