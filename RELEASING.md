# Releasing

Tagging is the whole procedure. Everything else is a consequence.

```bash
git tag v0.1.2 && git push --tags
```

## What the tag triggers

1. The tag is compared to the `version` in `src-tauri/tauri.conf.json` and
   `src-tauri/Cargo.toml`. They must match, and the job stops in seconds if they
   do not: an app whose reported version differs from the manifest would offer
   the same update forever, and reinstalling would never clear it.
2. The Windows installer is built and signed.
3. It is published to a fixed release, tagged `wallet-latest`, on the public
   `proteus-miner` repository, under a version-free filename. The download link
   therefore never changes, on the site, in the docs or on Discord.
4. A `latest.json` is written next to it. Installed copies read it, compare the
   version to their own, and offer the update in the app.

## Secrets the pipeline needs

| Secret | What it does |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | Signs the installer. The app verifies that signature against the public key built into the binary, which is what stops anyone able to write to the release from pushing a build to every wallet. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the above. |
| `MINER_RELEASE_TOKEN` | A token with contents read and write on `proteus-miner`. The default `GITHUB_TOKEN` cannot write to another repository. |

The signing key has no backup on GitHub: it cannot be read back once stored.
**Keep it in the vault.** Losing it means no installed copy can ever be updated
again, and every user has to reinstall by hand.

`MINER_RELEASE_TOKEN` is checked in the first seconds of the job rather than
guarded on the publish step. A publish step that skips silently when its token
is missing is how three miner releases were built green and never reached a
single user.
