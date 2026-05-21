import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '15mb' },
  },
  // MediaPipe & imgly ship wasm/binaries that Webpack should leave alone.
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    }
    return config;
  },
  async headers() {
    // COOP/COEP enable SharedArrayBuffer, which MediaPipe (face landmarker)
    // and the @imgly/background-removal Worker both need. BUT — these same
    // headers block third-party iframes that don't ship a matching
    // Cross-Origin-Resource-Policy, which means Stripe's embedded checkout
    // iframe gets refused. So scope the headers to the *only* path that
    // actually runs SharedArrayBuffer workloads: the editor. The landing,
    // pricing, checkout, success, and legal pages stay header-free so
    // js.stripe.com can mount its iframe on /checkout.
    const coopCoepHeaders = [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
    ];
    // Site-wide hardening headers, applied everywhere:
    //   · Permissions-Policy: delegates the Payment Request API to our
    //     origin and Stripe's iframes — without this, Chrome's autofill
    //     stack refuses to engage on the embedded checkout (the
    //     "this form does not use a secure connection" tooltip).
    //   · Strict-Transport-Security: pin HTTPS for 2 years incl. subdomains
    //     so browsers never downgrade to HTTP.
    //   · X-Content-Type-Options nosniff + Referrer-Policy: standard hardening
    //     that costs nothing and improves the security report card.
    const globalHardening = [
      {
        key: 'Permissions-Policy',
        value:
          'payment=(self "https://js.stripe.com" "https://checkout.stripe.com"), camera=(self), microphone=(), geolocation=()',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ];
    return [
      { source: '/:locale/editor', headers: coopCoepHeaders },
      { source: '/:locale/editor/:path*', headers: coopCoepHeaders },
      { source: '/(.*)', headers: globalHardening },
    ];
  },
};

export default withNextIntl(nextConfig);
