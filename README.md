# PROTEUS Wallet

A non-custodial desktop wallet for the PROTEUS chain ($PRTS), for Windows.

Hold, send and stake $PRTS, see what an address has done, and claim a referral.
It is the browser wallet from app.proteus-agent.com, packaged as an application,
with the storage moved from the browser to a file you can back up.

## Where the keys are

Keys are generated on the machine, by `@polkadot/keyring` inside the app, and
never leave it. There is no account, no email, no server side.

Accounts are stored as standard polkadot keystores, encrypted with the password
chosen for each account, in one file:

```
%APPDATA%\com.proteus-agent.wallet\accounts.json
```

That file is a plain JSON array. It can be copied to another machine or opened
with any polkadot-compatible tool. `create an account` also offers to save the
encrypted keystore anywhere else as a backup.

What is never written anywhere: the recovery phrase and the password. The phrase
is shown once, at creation, and only in the window. Unlocking happens in memory
for the time it takes to sign one transaction.

The Rust side holds no key material. It opens the window and provides four
things the web layer cannot do on its own: the accounts file, a save dialog, the
clipboard, and the updater. The one command it exposes, `write_backup`, writes
bytes it is handed to a path the OS save dialog returned.

## Build

```bash
npm ci
npm run tauri dev      # run it
npm run tauri build    # produce the NSIS installer
```

Requires Node 20 and a stable Rust toolchain. `VITE_RPC_URL` overrides the chain
endpoint, which defaults to `wss://rpc.proteus-agent.com`.

## Release

Tagging is the whole procedure:

```bash
git tag v0.1.1 && git push --tags
```

The tag must equal the `version` in both `src-tauri/tauri.conf.json` and
`src-tauri/Cargo.toml`; CI checks that first and stops in seconds if they drift,
because an app whose reported version differs from the manifest offers the same
update forever.

Two repository secrets are required for the build to produce an installable
update: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
They sign the `.sig` the installed app verifies against the public key baked
into `tauri.conf.json`. Without them the build still succeeds and every
installed copy refuses the update.

Every build publishes to ONE fixed release, tagged `wallet-latest`, on the
PUBLIC `proteus-miner` repository, holding `PROTEUS-Wallet-Setup.exe` and
`latest.json`. That is what people download and what installed copies poll, so
neither url ever moves while this repository stays private:

```
https://github.com/PROTEUS-COMPUTE/proteus-miner/releases/download/wallet-latest/PROTEUS-Wallet-Setup.exe
```

An installed copy reads `latest.json`, compares its version to its own, and
offers the update in the app. The `.sig` is verified against the public key
baked into the binary before anything installs, which is what stops anyone who
can write to that release from pushing a build to every wallet.

Cross-repo publishing needs `MINER_RELEASE_TOKEN`, a PAT with contents
read+write on `proteus-miner`. The default `GITHUB_TOKEN` cannot write to
another repository. It is checked in the first seconds of the job rather than
guarded on the publish step: a guarded publish that skips silently is how three
miner releases went out without reaching a single user.

## Not done yet

The installer is not signed with a Windows code-signing certificate, so
SmartScreen shows an "unknown publisher" warning on first run. That matters more
for a wallet than for anything else we ship.
