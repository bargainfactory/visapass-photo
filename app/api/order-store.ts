/**
 * In-memory order store.
 *
 * Replace with your durable store (Postgres + Prisma, DynamoDB, KV, etc.) for
 * production. The interface is intentionally minimal so the swap is small.
 */
export interface ServerOrder {
  id: string;
  packageId: string;
  documentId: string;
  email: string | null;
  amountCents: number;
  status: 'pending' | 'paid' | 'fulfilled' | 'shipped';
  createdAt: number;
}

class OrderStore {
  private map = new Map<string, ServerOrder>();

  upsert(order: ServerOrder) {
    this.map.set(order.id, { ...this.map.get(order.id), ...order });
  }
  update(id: string, patch: Partial<ServerOrder>) {
    const existing = this.map.get(id);
    if (!existing) return;
    this.map.set(id, { ...existing, ...patch });
  }
  get(id: string) {
    return this.map.get(id);
  }
}

// Reuse across Hot Module Reloads in dev — avoids losing in-memory state.
declare global {
  // eslint-disable-next-line no-var
  var __ORDER_STORE__: OrderStore | undefined;
}
export const orderStore: OrderStore = globalThis.__ORDER_STORE__ ?? new OrderStore();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__ORDER_STORE__ = orderStore;
}
