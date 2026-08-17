/* The @tauri-apps/plugin-fs surface store.ts uses, backed by node:fs.

   Test fixture, never bundled into the app: store.check.mjs aliases the plugin
   to this so the real store code runs against a real directory. The directory
   comes from PROTEUS_STORE_DIR, standing in for BaseDirectory.AppData. */
import fs from 'node:fs/promises';
import path from 'node:path';

export const BaseDirectory = { AppData: 'appdata' };

const at = (p) => path.join(process.env.PROTEUS_STORE_DIR, p);

export const exists = async (p) =>
  fs
    .access(at(p))
    .then(() => true)
    .catch(() => false);

export const readTextFile = (p) => fs.readFile(at(p), 'utf8');
export const writeTextFile = (p, body) => fs.writeFile(at(p), body, 'utf8');
export const remove = (p) => fs.rm(at(p));
export const rename = (from, to) => fs.rename(at(from), at(to));
export const mkdir = (p, opts) => fs.mkdir(at(p), { recursive: opts?.recursive });
