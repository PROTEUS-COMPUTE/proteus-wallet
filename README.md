# PROTEUS Wallet

![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white) &nbsp; ![non-custodial](https://img.shields.io/badge/non--custodial-1a1a1a?style=for-the-badge) &nbsp; ![$PRTS](https://img.shields.io/badge/hold-%24PRTS-9FFF00?style=for-the-badge&labelColor=1a1a1a)

The desktop wallet for **PROTEUS**, the sovereign Layer-1 where mining is useful GPU inference. Hold, send and stake **$PRTS** from your own machine, with your own keys.

**[Download PROTEUS-Wallet-Setup.exe](https://github.com/PROTEUS-COMPUTE/proteus-miner/releases/download/wallet-latest/PROTEUS-Wallet-Setup.exe)** · Windows 10 or 11, 4 MB, no account and no email.

## What it does

- **Hold and send $PRTS.** Create an account, or import the recovery phrase your miner already gave you.
- **Stake, and be paid for it.** Lock your $PRTS on the router for a duration you choose. The lock is enforced by the chain, never held by us, and it returns to your balance on its own.
- **See your mining rewards.** Emission lands on your hotkey as stake, not as spendable balance. The wallet shows both, and moving one to the other is one action.
- **Follow your activity.** Every transfer in and out, newest first, with a link to the block that carries it.
- **Claim a referral.** Generate your link, or credit the person who brought you in.

## Where your keys are

Keys are generated on your machine and never leave it. There is no account, no email, and no server involved in holding them.

Each account is stored as a standard Polkadot keystore, encrypted with the password you chose for it, in one file:

```
%APPDATA%\com.proteus-agent.wallet\accounts.json
```

That file is a plain JSON array, so it can be copied to a USB stick or opened by any Polkadot-compatible tool. The app also offers to save an encrypted keystore anywhere you like, as a backup.

**Never written anywhere: your recovery phrase and your password.** The phrase is shown once, when the account is created, and only on screen. Unlocking happens in memory for the time it takes to sign one transaction.

The native side of the app holds no key material at all. It opens the window and lends the interface four things it cannot do alone: the accounts file, a save dialog, the clipboard, and the updater.

> [!IMPORTANT]
> The installer is not yet signed with a Windows code-signing certificate, so SmartScreen shows an "unknown publisher" warning the first time you run it. Download only from the link above.

## Updates

The app checks for a new version on launch and offers it to you. Nothing installs on its own, and nothing installs without checking the signature against the key built into your copy. You choose when.

## Build it yourself

Requires Node 20 and a stable Rust toolchain.

```bash
npm ci
npm run tauri dev      # run it
npm run tauri build    # produce the installer
```

The chain endpoint defaults to `wss://rpc.proteus-agent.com`; set `VITE_RPC_URL` to point at your own node.

Two checks cover the part that cannot be undone, the keystore. Run them after touching key handling or storage:

```bash
node src/lib/wallet.check.mjs

npx esbuild src/lib/store.ts --format=esm --bundle --platform=node \
  --alias:@tauri-apps/plugin-fs=./src/lib/fs-stub.mjs --outfile=src/lib/store.mjs \
  && node src/lib/store.check.mjs && rm src/lib/store.mjs
```

## Releasing

Bump the version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, commit, then tag:

```bash
git tag v0.1.2 && git push --tags
```

CI builds and signs the installer, publishes it to the fixed download link above, and writes the manifest installed copies read. See [RELEASING.md](RELEASING.md) for what the pipeline needs.

## The rest of PROTEUS

- Mine with your GPU: [proteus-miner](https://github.com/PROTEUS-COMPUTE/proteus-miner)
- Network, explorer and web wallet: [proteus-agent.com](https://proteus-agent.com)
