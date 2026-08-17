import { Dot } from './ui';
import { RPC_URL, useApi } from '../lib/api';

/**
 * Whether the app is talking to the chain, said out loud.
 *
 * On the site the browser tab and the rest of the page make it obvious when
 * something is loading. A lone window does not: a balance that never appears
 * looks identical to a balance of zero. So the connection has its own line,
 * always visible, naming the endpoint it is dialling.
 */
export default function ChainStatus() {
  const { status, failure } = useApi();
  const host = RPC_URL.replace(/^wss?:\/\//, '');

  return (
    <footer className="w-full max-w-[560px] mx-auto px-6 pb-6">
      <div className="flex items-center gap-2 text-[12px] lowercase text-muted">
        <Dot color={status === 'connecte' ? 'lime' : status === 'connexion' ? 'gray' : 'red'} />
        {status === 'connecte'
          ? `connected to ${host}`
          : status === 'connexion'
            ? `connecting to ${host}…`
            : `${host} unreachable, retrying…`}
      </div>
      {failure && status !== 'connecte' && (
        <p className="text-[11.5px] text-faint mt-1 pl-3.5 break-words">{failure}</p>
      )}
    </footer>
  );
}
