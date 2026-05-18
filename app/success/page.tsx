'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Mail, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface OrderStatus {
  status: 'pending' | 'paid' | 'fulfilled' | 'shipped' | 'unknown';
  amountCents: number | null;
  documentId: string | null;
  email: string | null;
}

export default function SuccessPage() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const [status, setStatus] = React.useState<OrderStatus | null>(null);
  const [polls, setPolls] = React.useState(0);

  React.useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const fetchStatus = async () => {
      try {
        const r = await fetch(`/api/order-status?session_id=${encodeURIComponent(sessionId)}`);
        if (!r.ok) return;
        const data: OrderStatus = await r.json();
        if (!cancelled) setStatus(data);
      } catch {
        /* ignore */
      }
    };
    fetchStatus();
    const i = setInterval(() => {
      setPolls((p) => p + 1);
      fetchStatus();
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [sessionId]);

  const isFulfilled = status?.status === 'fulfilled' || status?.status === 'shipped';

  return (
    <div className="container max-w-2xl py-16">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold">Order received</h1>
              <p className="mt-2 text-muted-foreground">
                Stripe confirmed your payment. Below is the live fulfillment status — this page
                polls the webhook handler every few seconds.
              </p>
            </div>

            <div className="grid gap-3 text-left">
              <Row
                icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                label="Payment confirmed"
                value={status?.amountCents ? `$${(status.amountCents / 100).toFixed(2)}` : '—'}
              />
              <Row
                icon={
                  isFulfilled ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <Loader2 className="size-4 animate-spin text-brand-600" />
                  )
                }
                label="Fulfillment"
                value={statusLabel(status?.status)}
              />
              <Row
                icon={<Mail className="size-4" />}
                label="Receipt sent to"
                value={status?.email ?? '—'}
              />
              <Row
                icon={<Truck className="size-4" />}
                label="Shipping ETA"
                value="1–3 business days"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Webhook poll #{polls + 1} · session {sessionId?.slice(0, 14)}…
            </p>
            <Button asChild variant="brand" size="lg" className="w-full">
              <Link href="/editor">Create another photo</Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <Badge variant="outline">{value}</Badge>
    </div>
  );
}

function statusLabel(status?: OrderStatus['status']) {
  switch (status) {
    case 'pending':
      return 'Awaiting webhook';
    case 'paid':
      return 'Paid · queueing print';
    case 'fulfilled':
      return 'Printing now';
    case 'shipped':
      return 'Shipped';
    default:
      return 'Locating order…';
  }
}
