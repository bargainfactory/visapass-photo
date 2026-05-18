import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-background/50">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow">
              <ShieldCheck className="size-4" />
            </span>
            <span className="font-display text-lg">VisaPass Photo</span>
          </Link>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Generate ICAO-compliant passport and visa photos in seconds, with on-device AI. Your photo
            never leaves your browser unless you order physical prints.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Product</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/editor" className="hover:text-foreground">Open Editor</Link></li>
            <li><Link href="/#countries" className="hover:text-foreground">Supported Countries</Link></li>
            <li><Link href="/#pricing" className="hover:text-foreground">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Trust</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>WCAG 2.2 AA accessible</li>
            <li>End-to-end encrypted payments</li>
            <li>No image uploaded to our servers</li>
          </ul>
        </div>
      </div>
      <div className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VisaPass Photo — Built with Next.js 15, MediaPipe & imgly.
      </div>
    </footer>
  );
}
