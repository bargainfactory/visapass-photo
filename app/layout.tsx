// Root layout is intentionally minimal — every visible route lives under
// app/[locale]/* and the per-locale layout owns the <html> tag so `lang`
// and `dir` can change per request.
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
