/* The keystore round trip, checked without a browser and without Tauri.

   Run after touching anything that creates, encrypts or unlocks an account:
     node src/lib/wallet.check.mjs

   This covers the only failure in the app that cannot be undone. Everything
   else is a bad screen; a keystore that does not reopen, or that reopens with
   the wrong password, is somebody's coins gone. It is also silent by nature:
   creation always looks like it worked. */
import assert from 'node:assert';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, mnemonicGenerate } from '@polkadot/util-crypto';

await cryptoWaitReady();

const SS58 = 42;
const ring = () => new Keyring({ type: 'sr25519', ss58Format: SS58 });
const PASSWORD = 'correct horse battery staple';

const mnemonic = mnemonicGenerate(12);
const pair = ring().addFromUri(mnemonic, { name: 'check' });
const json = pair.toJson(PASSWORD);

// 1. the encrypted keystore is what gets written, and it holds no seed
const serialized = JSON.stringify(json);
assert.ok(!serialized.includes(mnemonic), 'the mnemonic must never appear in the keystore');
for (const word of mnemonic.split(' ')) {
  assert.ok(
    !serialized.includes(`"${word}"`),
    `the keystore leaks a word of the phrase: ${word}`
  );
}
assert.equal(json.encoding.type.includes('xsalsa20-poly1305'), true, 'expected an encrypted keystore');

// 2. it reopens with the right password, onto the same address
const reopened = ring().createFromJson(JSON.parse(serialized));
reopened.unlock(PASSWORD);
assert.equal(reopened.address, pair.address, 'the reopened account changed address');

// 3. and refuses the wrong one, loudly
assert.throws(
  () => {
    const p = ring().createFromJson(JSON.parse(serialized));
    p.unlock(PASSWORD + '!');
  },
  /decode|invalid|password/i,
  'a wrong password must throw, never return a locked-but-usable pair'
);

// 4. the phrase alone recovers the same address, which is what a backup promises
const recovered = ring().addFromUri(mnemonic, { name: 'recovered' });
assert.equal(recovered.address, pair.address, 'the recovery phrase does not restore the account');

// 5. a signature from the reopened account verifies against the original
const message = new TextEncoder().encode('proteus keystore check');
assert.ok(pair.verify(message, reopened.sign(message), pair.publicKey), 'signature mismatch');

console.log('keystore round trip ok:', pair.address);
