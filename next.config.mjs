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
    // next-intl's message extractor uses a dynamic `import(t)` that webpack's
    // persistent-cache analysis can't resolve, emitting two harmless cache-layer
    // warnings ("Parsing … for build dependencies failed" + "Build dependencies
    // behind this expression are ignored"). They come from webpack's
    // infrastructure logger (not compilation.warnings, so `ignoreWarnings` can't
    // touch them) and have zero runtime impact. Raise the infra log level to
    // `error` so they stop surfacing in the dev Issues panel.
    config.infrastructureLogging = { ...(config.infrastructureLogging ?? {}), level: 'error' };
    return config;
  },
  async headers() {
    // NOTE on COOP/COEP: we deliberately do NOT set them. They make the page
    // `crossOriginIsolated`, which switches onnxruntime-web (inside
    // @imgly/background-removal) to its THREADED wasm build — that spawns nested
    // pthread workers and crashes in this environment. MediaPipe (GPU delegate)
    // and imgly both run fine single-threaded without SharedArrayBuffer, so
    // dropping the headers makes background removal reliable AND lets Stripe's
    // embedded-checkout iframe mount without a cross-origin-isolation refusal.
    //
    // Site-wide hardening headers, applied everywhere:
    //   · Permissions-Policy: delegates the Payment Request API to our
    //     origin and Stripe's iframes — without this, Chrome's autofill
    //     stack refuses to engage on the embedded checkout (the
    //     "this form does not use a secure connection" tooltip).
    //   · Strict-Transport-Security: pin HTTPS for 2 years incl. subdomains
    //     so browsers never downgrade to HTTP.
    //   · X-Content-Type-Options nosniff + Referrer-Policy: standard hardening
    //     that costs nothing and improves the security report card.
    // Content-Security-Policy — allowlist only the origins this app actually
    // talks to. Stripe.js + embedded checkout need js.stripe.com (script +
    // frame) and api.stripe.com (connect). MediaPipe pulls its wasm/model from
    // jsdelivr + Google storage, and the editor decodes images/blobs (data:,
    // blob:). `frame-ancestors 'self'` blocks click-jacking (the site can't be
    // embedded by a third party). next/font self-hosts, so font-src stays self.
    //   NOTE: 'unsafe-inline'/'unsafe-eval' for script-src are required by
    //   Next's inline bootstrap + framework chunks without nonce wiring; tighten
    //   to a nonce-based policy if you later add per-request nonces.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      // js.stripe.com: Stripe.js. cdn.jsdelivr.net: MediaPipe tasks-vision WASM
      // loader script (FilesetResolver.forVisionTasks fetches its JS glue from
      // there). 'wasm-unsafe-eval'/'unsafe-eval' allow the MediaPipe + imgly
      // WebAssembly to instantiate. blob: is required because onnxruntime-web
      // (inside @imgly/background-removal) loads its backend by dynamically
      // importing a blob: module — without it ORT reports "no available backend".
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://js.stripe.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // api.stripe.com + merchant-ui-api.stripe.com: embedded checkout. jsdelivr
      // + storage.googleapis.com: MediaPipe wasm + face-landmarker model.
      // staticimgly.com: @imgly/background-removal model + wasm (its default CDN;
      // no publicPath override is set).
      "connect-src 'self' blob: data: https://api.stripe.com https://merchant-ui-api.stripe.com https://cdn.jsdelivr.net https://storage.googleapis.com https://staticimgly.com",
      // MediaPipe's GPU delegate spins up a worker from its WASM glue (blob or
      // jsdelivr); the imgly worker is bundled (self/blob).
      "worker-src 'self' blob: https://cdn.jsdelivr.net",
      // js.stripe.com: Stripe.js iframe. checkout.stripe.com: embedded checkout.
      // hooks.stripe.com: 3-D Secure challenge frames.
      "frame-src https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com",
      'upgrade-insecure-requests',
    ].join('; ');

    const globalHardening = [
      { key: 'Content-Security-Policy', value: csp },
      // Defense-in-depth clickjacking guard for legacy UAs that ignore CSP
      // frame-ancestors.
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
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
    return [{ source: '/(.*)', headers: globalHardening }];
  },
};

export default withNextIntl(nextConfig);
