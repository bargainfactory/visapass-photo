import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match every path except Next internals, API routes, metadata routes, and
  // static assets. `opengraph-image` has no file extension, so without an
  // explicit exclusion the i18n middleware would 307-redirect it to
  // `/<locale>/opengraph-image` (which 404s) and break social link previews.
  matcher: [
    '/((?!api|_next|_vercel|opengraph-image|sitemap.xml|robots.txt|icon.svg|.*\\..*).*)',
  ],
};
