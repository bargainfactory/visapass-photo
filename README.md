# VisaPass Photo

Studio-grade passport & visa photos in seconds — all rendered on-device.

VisaPass Photo is a production-ready **Next.js 15 (App Router) + TypeScript** application
that turns any selfie into an ICAO-compliant passport or visa photo for 20+ countries.
The entire image pipeline (468 MediaPipe landmarks, high-resolution background
removal, country-precise cropping, and 300-DPI print compositing) runs in the
browser. Stripe Checkout handles physical print fulfillment with proper webhook
signature verification.

```
✓ 468 facial landmarks via @mediapipe/tasks-vision
✓ High-res background swap in a Web Worker (@imgly/background-removal)
✓ 20+ country specs (US, UK, Schengen, India, China, Japan, …)
✓ Live split-view editor with brightness/contrast tuning
✓ 4×6 print-ready sheets at 300 DPI
✓ Stripe Checkout + verified webhook fulfillment
✓ Dark / light / system theme, WCAG 2.2 AA accessible
✓ shadcn/ui primitives, framer-motion micro-interactions
```

---

## 1. Stack

| Layer        | Tech                                                                |
| ------------ | ------------------------------------------------------------------- |
| Framework    | Next.js 15 (App Router, RSC where it helps), React 19, TypeScript    |
| Styling      | Tailwind CSS, shadcn/ui, CVA, lucide-react                          |
| Motion       | framer-motion                                                       |
| State        | Zustand (with localStorage persistence)                             |
| AI / CV      | @mediapipe/tasks-vision (Face Landmarker, 468 points)               |
| BG removal   | @imgly/background-removal (Web Worker, isnet model)                  |
| Payments     | @stripe/stripe-js, server-side `stripe` SDK with webhook signing    |
| Theming      | next-themes                                                         |

---

## 2. Quick start

```bash
git clone <repo>
cd "final passport website"
npm install
cp .env.example .env.local       # add your Stripe keys
npm run dev                      # http://localhost:3000
```

The dev server boots without any keys — the checkout API returns a mock session
when `STRIPE_SECRET_KEY` is missing so you can preview the success flow end-to-end.

---

## 3. Project layout

```
app/
  layout.tsx               # root layout, theme provider, header/footer
  page.tsx                 # landing (hero + features + country showcase)
  editor/page.tsx          # 4-step wizard: upload → select → studio → result
  success/page.tsx         # polls /api/order-status after Stripe redirects back
  api/
    checkout/route.ts      # POST  -> Stripe Checkout Session
    webhook/stripe/route.ts# POST  -> verified Stripe webhook + fulfillment hooks
    order-status/route.ts  # GET   -> polled by /success
    order-store.ts         # in-memory order persistence (swap for your DB)
    ai/                    # optional server-side fallbacks (stubs)

components/
  hero.tsx, feature-grid.tsx, country-showcase.tsx
  upload-dropzone.tsx, camera-capture.tsx
  country-selector.tsx
  editor-studio.tsx        # full pipeline + split-view preview + tuning
  landmark-overlay.tsx
  results-panel.tsx
  progress-stepper.tsx
  site-header.tsx, site-footer.tsx
  theme-provider.tsx, theme-toggle.tsx
  ui/                      # shadcn primitives (button, card, slider, …)

lib/
  countries.ts             # 20+ country specs (mm, head ratio, bg, glasses)
  face-landmarker.ts       # MediaPipe wrapper + landmark analysis
  crop-calculator.ts       # solves the compliant crop rect from landmarks
  compositor.ts            # canvas compositing + 4×6 sheet generation
  background-removal-client.ts # Web Worker proxy
  store.ts                 # Zustand store (persists doc choice + orders)
  stripe.ts                # server-side Stripe init + package catalogue
  utils.ts                 # cn(), mm/in -> px, downloadDataUrl, …

workers/
  background-removal.worker.ts # off-thread @imgly/background-removal
```

---

## 4. The image pipeline (high level)

```
Upload / Camera
    │
    ▼
HTMLImageElement at native resolution
    │                                       Web Worker (@imgly/background-removal)
    ▼                                                       │
MediaPipe Face Landmarker (468 points)                       ▼
    │                                       RGBA cutout (transparent bg)
    ▼                                                       │
crop-calculator.ts ─ solves a CropRect that satisfies        ▼
the country's head-height & eye-line ranges                  │
    └─────────────────►   compositor.ts   ◄──────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │ Final compliant JPEG (300 DPI)       │
            │ Print-ready 4×6 sheet (4-up / 8-up)  │
            └─────────────────────────────────────┘
```

Key decisions:

- **Why MediaPipe Face Landmarker (not BlazeFace)?**  
  468-point mesh gives exact chin (152), forehead (10), eye corners (33/263).
  We use those to measure head height (chin → crown) and eye-line vertical
  position, which is what every passport authority actually specifies.

- **Why a Web Worker for background removal?**  
  imgly's wasm pipeline pegs the main thread for several seconds at high
  resolution. Running it in a worker keeps the MediaPipe overlay smooth and
  lets the progress bar animate at 60fps. The worker also reuses the warmed-up
  model across photos.

- **Why composite at the source resolution, then downscale?**  
  Hair edges and shoulder seams remain crisp. Downscaling after compositing
  gives effectively 600 DPI input → 300 DPI output supersampling.

- **Why a JSON config of country specs?**  
  Specifications change. The single source of truth is [`lib/countries.ts`](lib/countries.ts).
  Each entry includes physical dimensions (mm), allowed head-height ratios,
  eye-line position, background color, glasses & expression policy.

---

## 5. Stripe setup

1. Create a Stripe account & put test keys in `.env.local`.
2. Install the CLI: `brew install stripe/stripe-cli/stripe` (or platform equiv).
3. Forward webhooks locally:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```

   Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.

4. The webhook handler ([app/api/webhook/stripe/route.ts](app/api/webhook/stripe/route.ts)):
   - Verifies the `stripe-signature` using the **raw** request body.
   - Handles `checkout.session.completed`.
   - Persists the order in `orderStore` (replace with your DB).
   - Calls `mockSendReceiptEmail` and `mockSubmitToPrintQueue` — wire these to
     your real email and print partner.
   - Responds with `200 { received: true }` quickly so Stripe doesn't retry.

5. The `/success` page polls `/api/order-status?session_id=…` every 4s so the
   fulfillment status badge updates live as the webhook fires.

### Production webhook URL

Deploy to Vercel and use `https://<your-domain>/api/webhook/stripe` as the
endpoint. Vercel passes the raw body through correctly — no extra config.

---

## 6. Server-side AI fallback (optional)

The default pipeline is **100% client-side**. If you need higher accuracy on
profile shots, low-resolution inputs, or production SLAs, plug a server model
into the stubs at:

- [`app/api/ai/remove-background/route.ts`](app/api/ai/remove-background/route.ts)
- [`app/api/ai/detect-face/route.ts`](app/api/ai/detect-face/route.ts)

Suggested vendors (sample integration notes are inline in the route files):

| Vendor                | Best for                                  |
| --------------------- | ----------------------------------------- |
| Replicate             | RMBG-2.0 / SAM / InSPyReNet — quick swap   |
| Hugging Face Inference| `briaai/RMBG-1.4`, very low cost          |
| Google Cloud Vision   | `faceAnnotations`, very accurate landmarks |
| Azure Face API        | Pose, smile, glasses detection            |
| AWS Rekognition       | `DetectFaces` with quality checks         |
| Self-host             | rembg + InsightFace on Triton / Modal     |

Then in [`lib/background-removal-client.ts`](lib/background-removal-client.ts)
or [`lib/face-landmarker.ts`](lib/face-landmarker.ts), branch on a feature flag
to call the server route instead of the local worker.

---

## 7. Deploying to Vercel

```bash
npm i -g vercel
vercel link
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel --prod
```

Vercel automatically:
- Routes `/api/webhook/stripe` through the Node runtime (`runtime = 'nodejs'`).
- Serves the MediaPipe WASM from jsdelivr (no custom Edge config needed).
- Respects the COOP/COEP headers in [next.config.mjs](next.config.mjs) so
  SharedArrayBuffer-enabled WASM stays available.

---

## 8. Extending — adding a country

Append an entry to `COUNTRIES` in [lib/countries.ts](lib/countries.ts):

```ts
{
  code: 'XX',
  name: 'Your country',
  flag: '🏳️',
  documents: [
    {
      id: 'xx-passport',
      type: 'passport',
      label: 'XX Passport (35×45 mm)',
      widthMm: 35,
      heightMm: 45,
      headHeightRatio: [0.7, 0.8],
      eyeLineFromBottom: [0.55, 0.7],
      background: '#FFFFFF',
      glasses: 'forbidden',
      expression: 'neutral',
      dpi: 300,
    },
  ],
}
```

That single addition propagates through the search, presets, editor, and
country showcase automatically.

---

## 9. Accessibility & UX notes

- Skip-to-content link, focus-visible rings, semantic `<main>` / `<section>`.
- Color contrast meets WCAG 2.2 AA in both light and dark themes.
- All sliders, switches, dialogs are Radix primitives — keyboard accessible.
- Friendly errors with actionable next steps ("Try a clearer, well-lit photo").
- localStorage persists the chosen country + recent orders so reloading the
  editor doesn't lose your place. Photos themselves are kept in-memory only.

---

## 10. License

MIT.
