import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type RpcStatus = 'connexion' | 'connecte' | 'deconnecte';

/**
 * Whatever the connection last complained about.
 *
 * A window that says "connecting…" forever tells nobody anything, and the
 * failures that land here are the silent kind: a blocked WebAssembly module, a
 * socket that opens and never speaks. Keeping the message means the next report
 * carries the cause instead of the symptom.
 */
export type ApiFailure = string | null;

/**
 * The chain this wallet talks to.
 *
 * The default is the public endpoint, not localhost. Vite bakes this at build
 * time and a packaged app has no runtime env, so a wrong default does not
 * degrade, it ships: every installed copy would dial a node that is not there
 * and show an empty balance. VITE_RPC_URL still overrides it for a local node.
 */
export const RPC_URL: string =
  (import.meta.env.VITE_RPC_URL as string | undefined) || 'wss://rpc.proteus-agent.com';

type ApiCtxValue = {
  /** null until the api is ready */
  api: ApiPromise | null;
  status: RpcStatus;
  failure: ApiFailure;
};

const ApiCtx = createContext<ApiCtxValue>({ api: null, status: 'connexion', failure: null });

export function ApiProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [status, setStatus] = useState<RpcStatus>('connexion');
  const [failure, setFailure] = useState<ApiFailure>(null);

  useEffect(() => {
    // the WsProvider automatically retries every 3s if the node is unreachable
    const provider = new WsProvider(RPC_URL, 3000);
    const instance = new ApiPromise({ provider, throwOnConnect: false });

    instance.on('ready', () => {
      setApi(instance);
      setStatus('connecte');
      setFailure(null);
    });
    instance.on('connected', () => {
      // after a reconnection, 'ready' does not re-emit: switch back to connected as soon as the api is ready
      instance.isReady.then(() => setStatus('connecte')).catch(() => undefined);
    });
    instance.on('disconnected', () => setStatus('deconnecte'));
    instance.on('error', (e: unknown) => {
      setStatus('deconnecte');
      setFailure(e instanceof Error ? e.message : String(e));
    });

    // The socket can open and the api still never become usable, which is what
    // a blocked wasm module looks like from here: no error event, no ready
    // event, just silence. Say so rather than showing "connecting" for ever.
    const stall = setTimeout(() => {
      setStatus((s) => {
        if (s === 'connexion') {
          setFailure('the node answered but the connection never completed');
        }
        return s;
      });
    }, 20000);

    return () => {
      clearTimeout(stall);
      instance.disconnect().catch(() => undefined);
    };
  }, []);

  return <ApiCtx.Provider value={{ api, status, failure }}>{children}</ApiCtx.Provider>;
}

export function useApi(): ApiCtxValue {
  return useContext(ApiCtx);
}
