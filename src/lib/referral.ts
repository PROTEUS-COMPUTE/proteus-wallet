/**
 * The referral token, carried from the link to the deploy screen.
 *
 * Nobody read `?ref=` before. The referrer shared a link, the referee opened
 * it, and the pair was lost in that same second: the token stayed in an URL
 * that `/` immediately redirects away from, and nothing on our side ever saw
 * the two names together. 141 opens produced zero attributable referral.
 *
 * It is read before the router mounts, because `<Navigate to="/network">`
 * drops the query string and would erase the token first.
 *
 * The referee declares their own referrer, never the reverse. Every eligible
 * hotkey is public, so a channel where a REFERRER names a referee lets anyone
 * claim strangers. Here the token travels with the person who benefits from
 * nothing, which is what makes it trustworthy enough to pay on.
 */
const KEY = 'proteus.ref';

/**
 * What a referee signs to credit their referrer. Lives here and not in the card
 * because it is shared with cloud_register.py and referral_claims.py and must
 * match them byte for byte, and because a non-component export from a component
 * file breaks React Fast Refresh.
 *
 * The referrer is INSIDE the message: otherwise a signature could be lifted
 * from one declaration and replayed to credit somebody else.
 */
export const referredByMessage = (referrer: string) => `PROTEUS referred-by v1: ${referrer}`;

/** Base64url of a signed `{v, ref, sig}`, so this alphabet and nothing else. */
const SHAPE = /^[A-Za-z0-9_-]{24,600}$/;

export function captureRef(search: string): void {
  const token = new URLSearchParams(search).get('ref');
  if (token && SHAPE.test(token)) localStorage.setItem(KEY, token);
}

export function storedRef(): string | null {
  const token = localStorage.getItem(KEY);
  return token && SHAPE.test(token) ? token : null;
}

/**
 * The referrer's address, out of the token, so the referee can see WHO they are
 * about to credit before signing. Reading it here proves nothing: the signature
 * inside is verified on the server, against the address it claims.
 *
 * Accepts a whole link as well as a bare token, because that is what people
 * actually have in hand.
 */
export function refAddress(tokenOrLink: string): string | null {
  const raw = tokenOrLink.trim();
  const token = raw.includes('ref=') ? raw.split('ref=')[1].split('&')[0] : raw;
  if (!SHAPE.test(token)) return null;
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const addr = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))).ref;
    return typeof addr === 'string' && addr.length > 40 ? addr : null;
  } catch {
    return null;
  }
}
