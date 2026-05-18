import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Sora, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const sora = Sora({ subsets: ['latin'], variable: '--font-display' });
const jb = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL('https://visapass.photo'),
  title: {
    default: 'VisaPass Photo — On-device passport & visa photos',
    template: '%s · VisaPass Photo',
  },
  description:
    'Generate ICAO-compliant passport and visa photos in seconds. 468 MediaPipe landmarks, on-device background removal, and Stripe-powered print fulfillment.',
  keywords: [
    'passport photo',
    'visa photo',
    'ICAO compliant',
    'AI background removal',
    'MediaPipe',
    'Next.js 15',
  ],
  openGraph: {
    title: 'VisaPass Photo',
    description: 'Studio-grade passport & visa photos in seconds, powered by on-device AI.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  authors: [{ name: 'VisaPass Photo' }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1c' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          sora.variable,
          jb.variable,
          'font-sans selection:bg-brand-500/30 selection:text-brand-900 dark:selection:text-brand-100'
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={150}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
            >
              Skip to content
            </a>
            <SiteHeader />
            <main id="main" className="min-h-screen">
              {children}
            </main>
            <SiteFooter />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
