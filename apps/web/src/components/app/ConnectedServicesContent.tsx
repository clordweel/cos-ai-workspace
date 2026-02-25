'use client';

import { useState } from 'react';
import { Link2, Unlink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConnectedServices } from '@/hooks/useConnectedServices';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** 授权管理：已连接服务列表，连接/断开 ERPNext、Outline 等 */
export function ConnectedServicesContent() {
  const { providers, loading, error, connect, disconnect } = useConnectedServices();
  const [connectProvider, setConnectProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenConnect = (id: string) => {
    setConnectProvider(id);
    setApiKey('');
    setApiSecret('');
  };

  const handleConnect = async () => {
    if (!connectProvider) return;
    setSubmitting(true);
    try {
      const ok = await connect(connectProvider, { apiKey: apiKey.trim() || undefined, apiSecret: apiSecret.trim() || undefined });
      if (ok) setConnectProvider(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    const ok = await disconnect(id);
    if (ok) setConnectProvider(null);
  };

  return (
    <div className="flex min-h-full flex-col p-4">
      <h2 className="text-sm font-semibold text-foreground mb-2">授权管理</h2>
      <p className="text-xs text-muted-foreground mb-4">
        连接后，备忘录等应用将使用您在该服务中的身份访问数据。
      </p>

      {error && (
        <p className="text-xs text-destructive mb-2">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : (
        <ul className="space-y-2">
          {providers.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground">{p.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {p.connected ? (
                  <>
                    <span className="text-xs text-muted-foreground">已连接</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground"
                      onClick={() => handleDisconnect(p.id)}
                    >
                      <Unlink className="h-3 w-3" aria-hidden />
                      断开
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => handleOpenConnect(p.id)}
                  >
                    <Link2 className="h-3 w-3" aria-hidden />
                    连接
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(connectProvider)} onOpenChange={(open) => !open && setConnectProvider(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              连接 {connectProvider === 'erpnext' ? 'ERPNext' : connectProvider === 'outline' ? 'Outline' : connectProvider}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="connector-apiKey">API Key</Label>
              <Input
                id="connector-apiKey"
                type="password"
                placeholder={connectProvider === 'erpnext' ? 'ERP 用户 API Key' : 'API Key'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            {connectProvider === 'erpnext' && (
              <div className="grid gap-2">
                <Label htmlFor="connector-apiSecret">API Secret（可选）</Label>
                <Input
                  id="connector-apiSecret"
                  type="password"
                  placeholder="API Secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConnectProvider(null)}>
              取消
            </Button>
            <Button type="button" onClick={handleConnect} disabled={!apiKey.trim() || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              连接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
