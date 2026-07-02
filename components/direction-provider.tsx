'use client';

import { DirectionProvider as RadixDirectionProvider } from '@radix-ui/react-direction';

/**
 * Client wrapper around Radix's DirectionProvider. The package ships without a
 * 'use client' directive, so importing it straight into the (server) locale
 * layout runs React.createContext on the server and breaks static generation.
 * This boundary keeps it client-side while still receiving `dir` computed on
 * the server.
 */
export function DirectionProvider({
  dir,
  children,
}: {
  dir: 'ltr' | 'rtl';
  children: React.ReactNode;
}) {
  return <RadixDirectionProvider dir={dir}>{children}</RadixDirectionProvider>;
}
