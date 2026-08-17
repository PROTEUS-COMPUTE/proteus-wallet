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
};

const ApiCtx = createContext<ApiCtxValue>({ api: null, status: 'connexion' });

export function ApiProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [status, setStatus] = useState<RpcStatus>('connexion');

  useEffect(() => {
    // the WsProvider automatically retries every 3s if the node is unreachable
    const provider = new WsProvider(RPC_URL, 3000);
    const instance = new ApiPromise({ provider, throwOnConnect: false });

    instance.on('ready', () => {
      setApi(instance);
      setStatus('connecte');
    });
    instance.on('connected', () => {
      // after a reconnection, 'ready' does not re-emit: switch back to connected as soon as the api is ready
      instance.isReady.then(() => setStatus('connecte')).catch(() => undefined);
    });
    instance.on('disconnected', () => setStatus('deconnecte'));
    instance.on('error', () => setStatus('deconnecte'));

    return () => {
      instance.disconnect().catch(() => undefined);
    };
  }, []);

  return <ApiCtx.Provider value={{ api, status }}>{children}</ApiCtx.Provider>;
}

export function useApi(): ApiCtxValue {
  return useContext(ApiCtx);
}
