# VisaPass Photo

Studio-grade passport & visa photos in seconds — the whole image pipeline runs **on-device**.

VisaPass Photo is a **Next.js 16 (App Router) + TypeScript** application that turns any
selfie into an ICAO-compliant passport or visa photo for **22 countries**, localized into
**14 languages**. Face detection, background removal, country-precise cropping, an on-device
compliance pre-check, and 300-DPI print compositing all run in the browser. Stripe embedded
checkout handles payment, gated by a client-side encryption paywall.

```
✓ 468 facial landmarks + blendshapes via @mediapipe/tasks-vision
✓ High-res background removal in a Web Worker (@imgly/background-removal, WebGPU→CPU fallback)
✓ 22 country specs (US, UK, Schengen, Canada, India, China, Japan, …)
✓ On-device ICAO compliance pre-check (head size, eyes open, expression, level, framing)
✓ Manual framing (zoom / position) + brightness / contrast / shadow tuning
✓ HEIC/HEIF (iPhone) transcoding on upload
✓ 4×6 print-ready sheets at 300 DPI (+ Canada guarantor back template)
✓ Stripe embedded checkout + payment-gated encryption paywall + verified webhook
✓ 14 locales (incl. RTL Arabic), dark-by-default theme
✓ Per-country programmatic-SEO landing pages, sitemap, hreflang, JSON-LD
```

---

## 1. Stack

| Layer      | Tech                                                                  |
| ---------- | -------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router), React 18, TypeScript (strict)               |
| i18n       | next-intl (14 locales, RTL-aware), middleware convention `proxy.ts`  |
| Styling    | Tailwind CSS, shadcn/ui (Radix), CVA, lucide-react                   |
| Motion     | framer-motion                                                        |
| State      | Zustand (localStorage-persisted, image data intentionally not persisted) |
| AI / CV    | @mediapipe/tasks-vision (Face Landmarker + blendshapes)              |
| BG removal | @imgly/background-removal (Web Worker, onnxruntime-web)              |
| HEIC       | heic2any (lazy-loaded, client-side)                                  |
| Payments   | @stripe/stripe-js + @stripe/react-stripe-js (embedded), server `stripe` SDK |
| Crypto     | WebCrypto AES-GCM + IndexedDB (paywall delivery)                     |
| Theming    | next-themes (dark by default)                                        |

---

## 2. Quick start

```bash
npm install
cp .env.example .env.local     # fill in Stripe keys (optional — demo mode works without)
npm run dev                    # http://localhost:3000
```

Scripts: `npm run dev` · `npm run build` · `npm run start` · `npm run lint` (ESLint 9 flat
config) · `npm run typecheck`.

Without `STRIPE_SECRET_KEY` set, checkout runs in **demo mode** ("Simulate payment") so the
whole flow — including the encrypted delivery — can be exercised locally.

---

## 3. Project layout

```
app/
  [locale]/              # all localized routes (next-intl, localePrefix: 'always')
    page.tsx             # landing (hero, features, countries, pricing)
    editor/page.tsx      # 4-step wizard: upload → country → studio → results
    checkout/page.tsx    # Stripe EmbeddedCheckout on our own domain
    success/page.tsx     # decrypts IndexedDB ciphertext with the payment-released key
    legal/{terms,privacy,refunds}/
    photo/[country]/     # programmatic-SEO country landing pages
    layout.tsx           # <html lang/dir>, providers, metadata
  api/
    checkout/            # creates a Stripe session, stores the AES key in metadata
    release-key/         # returns the AES key ONLY when Stripe confirms payment
    order-status/        # polls Stripe (source of truth) for payment status
    webhook/stripe/      # signature-verified webhook (fulfillment side-effects)
    ai/{detect-face,remove-background}/  # 501 stubs for optional server-side fallback
  sitemap.ts · opengraph-image.tsx · icon.svg
components/              # editor-studio, results-panel, camera-capture, ui/* (shadcn), …
lib/                    # countries, crop-calculator, compositor, compliance, face-landmarker,
                        # background-removal-client, secure-delivery, preview, heic, rate-limit, stripe, store
workers/                # background-removal.worker.ts
messages/               # en.json + 13 locales (key-consistent)
i18n/                   # routing, request, navigation, metadata (hreflang helper)
proxy.ts                # next-intl middleware (Next 16 convention)
```

---

## 4. How it works

**On-device pipeline** (`components/editor-studio.tsx`): upload (HEIC transcoded) →
MediaPipe Face Landmarker (468 points + blendshapes) → `calculateCrop` to the country spec →
`@imgly/background-removal` in a Web Worker → `composeFinal` canvas compositor → on-device
compliance check (`lib/compliance.ts`). Manual framing (`applyCropAdjust`) and color sliders
recompose live.

**Payment-gated delivery** (the paywall): deliverables are AES-GCM encrypted in the browser;
the ciphertext is stored in IndexedDB (`lib/secure-delivery.ts`) and the pre-payment preview
is a baked-watermark, downscaled image (`lib/preview.ts`) — the clean file never enters the
DOM. The AES key rides in the Stripe session metadata and is released by `/api/release-key`
**only** once Stripe confirms `payment_status === 'paid'`. No server-side image storage, no
upload — the photo never leaves the device.

---

## 5. Environment variables

See `.env.example`. Set these in Vercel (Production) for live payments:

| Var                                  | Purpose                                        |
| ------------------------------------ | ---------------------------------------------- |
| `STRIPE_SECRET_KEY`                  | Create sessions; retrieve for status/key release |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js on the client                        |
| `STRIPE_WEBHOOK_SECRET`              | Verify `checkout.session.completed` webhooks   |
| `NEXT_PUBLIC_SITE_URL`               | e.g. `https://www.visapassphoto.com`           |

`.env.local` is git-ignored — never commit real keys.

---

## 6. Deployment

Deploys continuously to **Vercel** from `main`. To go live with real payments: activate the
Stripe live account, swap the three Stripe vars to `sk_live_`/`pk_live_` + a live webhook
secret, and redeploy.

**Security headers / CSP** live in `next.config.mjs` (`frame-ancestors`, HSTS, nosniff,
Permissions-Policy, and a scoped CSP). COOP/COEP are intentionally **not** set — enabling
`crossOriginIsolated` switches onnxruntime-web to a threaded build that crashes here, and the
single-threaded path works fine (MediaPipe/imgly don't need SharedArrayBuffer). Do not re-add
them.

**Third-party runtime assets:** MediaPipe wasm/model load from jsdelivr (→ unpkg fallback) +
Google storage; the imgly model loads from `staticimgly.com`. For zero third-party dependency
you can self-host these under your own origin and tighten the CSP accordingly.

---

## 7. Notes

- **Not-yet-durable:** the webhook order store is in-memory (fine — status reads Stripe
  directly). Wire a real DB + `event.id` dedupe before relying on webhook side-effects.
- **Rate limiting** (`lib/rate-limit.ts`) is in-memory / best-effort; swap for Upstash or
  Vercel KV for a hard, distributed limit.
- Country specs (`lib/countries.ts`) reflect public specifications at authoring time — always
  verify against the issuing authority for production use.
