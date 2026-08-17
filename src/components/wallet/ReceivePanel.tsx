import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy } from 'lucide-react';
import { Button, InfoNote, Skeleton } from '../ui';
import { copyText } from '../../lib/platform';
import type { WalletAccount } from './types';

type Props = {
  account: WalletAccount;
};

export default function ReceivePanel({ account }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSvg(null);
    QRCode.toString(account.address, {
      type: 'svg',
      margin: 0,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [account.address]);

  const copy = async () => {
    try {
      await copyText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable: the address stays selectable by hand */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        {svg ? (
          <div
            className="bg-white rounded-[14px] border border-black/[0.07] p-4 [&_svg]:w-[180px] [&_svg]:h-[180px]"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <Skeleton className="w-[212px] h-[212px] rounded-[14px]" />
        )}
      </div>

      <div>
        <div className="text-[12.5px] text-muted lowercase mb-1.5">
          address of {account.name} (generic ss58, format 42)
        </div>
        <div className="font-mono text-[13px] break-all bg-bg-2/60 rounded-xl px-3.5 py-3 text-ink-soft">
          {account.address}
        </div>
      </div>

      <Button type="button" variant="ghost" onClick={copy}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'copied' : 'copy the address'}
      </Button>

      <InfoNote>
        only send $prts to this address. funds arrive as soon as a block includes them.
      </InfoNote>
    </div>
  );
}
