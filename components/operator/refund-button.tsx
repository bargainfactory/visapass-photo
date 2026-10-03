'use client';

import * as React from 'react';
import { Loader2, Undo2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

/** Operator console: full refund of one order, confirm-first, with optional note. */
export function RefundButton({ sessionId, amountLabel }: { sessionId: string; amountLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function refund() {
    const note = window.prompt(`Refund ${amountLabel} in full for ${sessionId}?\n\nOptional note for the Stripe record:`, '');
    if (note === null) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/operator/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason: note }),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setError(data.error ?? 'refund_failed');
        return;
      }
      router.refresh();
    } catch {
      setError('refund_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={refund} disabled={busy} className="text-destructive hover:text-destructive">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
        Refund
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
