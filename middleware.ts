import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match every path except Next internals, API routes, and static assets.
  matcher: [
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
