import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export const metadata: Metadata = { title: 'Privacy Policy' };

const LAST_UPDATED = '2026-05-19';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <h2>The short version</h2>
      <ul>
        <li>
          <strong>Your photo never leaves your device.</strong> All face detection, background
          removal, cropping, and compositing run inside your browser. We do not see, receive, or
          store any photograph you upload.
        </li>
        <li>
          <strong>Payment is processed by Stripe.</strong> We never touch your card details.
        </li>
        <li>
          <strong>We retain only minimal order metadata</strong> — Stripe session ID, country
          code, document type, package, and timestamp — so we can verify your purchase and
          unlock your download.
        </li>
      </ul>

      <h2>1. Who we are</h2>
      <p>
        VisaPass Photo ("we", "us") is the operator of <a href="https://visapass.photo">visapass.photo</a>.
        For privacy questions: <a href="mailto:privacy@visapass.photo">privacy@visapass.photo</a>.
      </p>

      <h2>2. What runs on your device only</h2>
      <p>The following operations are executed entirely in your browser and never leave it:</p>
      <ul>
        <li>Image decoding from your upload or camera capture.</li>
        <li>
          Facial-landmark detection via Google's MediaPipe Tasks Vision (downloaded as a WASM
          model directly from a public CDN to your browser).
        </li>
        <li>
          Background removal via the @imgly/background-removal library (a Web Worker running an
          ONNX segmentation model in your browser).
        </li>
        <li>Country-specific cropping, color tuning, and JPEG/PNG export.</li>
      </ul>
      <p>
        Once your purchase is confirmed by Stripe, the rendered photograph is delivered to you
        directly from your own browser memory. It is not uploaded to our servers as part of
        this flow.
      </p>

      <h2>3. What we do collect</h2>
      <p>We collect only what is strictly necessary to operate the Service:</p>
      <ul>
        <li>
          <strong>Order metadata</strong>: Stripe checkout session ID, the document type and
          country code you selected, the package purchased, the amount paid, and a timestamp.
        </li>
        <li>
          <strong>Payment details — but only via Stripe</strong>. When you complete a payment,
          Stripe collects your card number, billing address, CVC, and (for wallet payments)
          token data. Stripe shares only a token and the final payment status with us; we never
          have access to raw card data. Stripe's handling is governed by{' '}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
            Stripe's Privacy Policy
          </a>
          .
        </li>
        <li>
          <strong>Receipt email</strong>: if you opt in on Stripe's checkout page, Stripe sends
          your receipt to the email you provide. We see the email address only if Stripe shares
          it back with the session metadata.
        </li>
        <li>
          <strong>Standard server logs</strong>: our hosting provider records HTTP request
          metadata (IP address, user agent, timestamp) for security and abuse prevention. These
          logs are retained for up to 30 days.
        </li>
        <li>
          <strong>Local browser storage</strong>: we store your locale preference, theme
          (light/dark), the document type you last picked, and recent order IDs in your
          browser's <code>localStorage</code> / <code>sessionStorage</code>. This data never
          leaves your device.
        </li>
      </ul>

      <h2>4. Cookies</h2>
      <p>
        We do not set advertising or cross-site tracking cookies. Stripe may set its own cookies
        on its embedded checkout iframe for fraud prevention; those are described in Stripe's
        policy.
      </p>

      <h2>5. Third parties</h2>
      <p>The Service relies on the following sub-processors:</p>
      <ul>
        <li>
          <strong>Stripe, Inc.</strong> — payment processing.{' '}
          <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
            Policy
          </a>
          .
        </li>
        <li>
          <strong>Vercel Inc.</strong> — hosting and edge delivery.{' '}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            Policy
          </a>
          .
        </li>
        <li>
          <strong>jsDelivr / Google Cloud Storage</strong> — public CDNs that deliver the
          MediaPipe and imgly model files to your browser. Standard HTTP request logs apply.
        </li>
      </ul>

      <h2>6. Legal bases &amp; retention (GDPR / UK GDPR)</h2>
      <ul>
        <li>
          <strong>Order processing</strong> — performance of a contract (Art. 6(1)(b) GDPR).
          Retained for 7 years for tax and accounting purposes.
        </li>
        <li>
          <strong>Server logs</strong> — legitimate interest in security (Art. 6(1)(f)).
          Retained for up to 30 days.
        </li>
        <li>
          <strong>Email receipts</strong> — performance of a contract; managed by Stripe.
        </li>
      </ul>

      <h2>7. Your rights</h2>
      <p>
        Depending on your jurisdiction (GDPR, UK GDPR, CCPA/CPRA, LGPD, etc.) you may have the
        right to access, correct, delete, port, or restrict the processing of your personal
        data, and to lodge a complaint with a supervisory authority. To exercise any of these
        rights, email <a href="mailto:privacy@visapass.photo">privacy@visapass.photo</a> with
        your Stripe session ID. We do not sell personal data.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Our sub-processors may transfer data outside your country of residence. Stripe and
        Vercel rely on Standard Contractual Clauses and equivalent safeguards where required.
      </p>

      <h2>9. Children</h2>
      <p>
        The Service is not directed to children under 16. We do not knowingly collect personal
        data from anyone under that age. If you believe a minor has used the Service without
        adult supervision, contact us and we will delete any associated metadata.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be announced on this
        page with a revised "Last updated" date.
      </p>

      <h2>11. Contact</h2>
      <p>
        Data-protection officer / privacy questions:{' '}
        <a href="mailto:privacy@visapass.photo">privacy@visapass.photo</a>.
      </p>
    </>
  );
}
