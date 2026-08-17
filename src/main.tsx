/**
 * The whole app: one wallet, no router.
 *
 * The web version mounts eight routes behind a navbar. None of that belongs in
 * a desktop wallet, and shipping it would leave links to pages that do not
 * exist. What survives is what the wallet actually needs: the chain connection
 * above everything, and the wallet under it.
 *
 * The accounts file is read BEFORE the first render. The account list is read
 * synchronously while rendering, so mounting first would paint an empty wallet
 * for a frame, which reads exactly like "my coins are gone".
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Wallet from './Wallet';
import UpdateBanner from './components/UpdateBanner';
import { ApiProvider } from './lib/api';
import { loadAccounts } from './lib/store';

const root = createRoot(document.getElementById('root')!);

void loadAccounts().finally(() => {
  root.render(
    <StrictMode>
      <ApiProvider>
        <div className="min-h-screen flex flex-col">
          <UpdateBanner />
          <main className="flex-1 w-full max-w-[560px] mx-auto px-6 py-10">
            <Wallet />
          </main>
        </div>
      </ApiProvider>
    </StrictMode>
  );
});
