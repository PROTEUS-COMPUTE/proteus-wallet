/**
 * The handful of browser calls that do not survive a webview, in one place.
 *
 * navigator.clipboard, window.confirm and <a target="_blank"> either throw or,
 * worse, do nothing at all inside WebView2. The web wallet swallowed those
 * failures in empty catch blocks, which is fine on a site and dangerous here: a
 * copy button that copies nothing, or a delete that skips its confirmation.
 */
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';

/** The website this app is the desktop half of. Anything the wallet fetches or
 *  links to is resolved against it: inside the app a relative url points at the
 *  bundle itself, so `/tx/...` would 404 forever without this. */
export const SITE = 'https://app.proteus-agent.com';

export const siteUrl = (path: string) => new URL(path, SITE).toString();

export async function copyText(text: string): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function confirmDialog(message: string, title = 'proteus wallet'): Promise<boolean> {
  return tauriConfirm(message, { title, kind: 'warning' });
}

/** Opens a link in the real browser. Without this a target=_blank navigates the
 *  app window itself, and the user has no back button to return to their wallet. */
export async function openExternal(url: string): Promise<void> {
  await openUrl(url).catch(() => undefined);
}
