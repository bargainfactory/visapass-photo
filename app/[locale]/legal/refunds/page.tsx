import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export const metadata: Metadata = { title: 'Refund & Cancellation Policy' };

const LAST_UPDATED = '2026-05-19';

export default async function RefundsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <h1>Refund &amp; Cancellation Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <h2>The short version</h2>
      <ul>
        <li>
          <strong>Defective files: full refund.</strong> If the rendered photograph fails to
          download, is corrupted, or violates the country specifications we publish, we refund
          the full amount. Within 14 days of purchase, no questions asked.
        </li>
        <li>
          <strong>Acceptance by an issuing authority is not our guarantee.</strong> A
          government office rejecting the photograph for reasons outside our published spec
          (lighting, expression, glasses, hair, attire, biometric scoring, etc.) is not by
          itself grounds for a refund.
        </li>
        <li>
          <strong>To request a refund</strong>, email{' '}
          <a href="mailto:support@visapass.photo">support@visapass.photo</a> with your Stripe
          session ID. Refunds are issued through Stripe and typically appear in 5–10 business
          days.
        </li>
      </ul>

      <h2>1. What you're buying</h2>
      <p>
        Each purchase is a one-time license to download a specific render — either a single
        compliant JPEG/PNG (Digital Download), a 4×6" multi-up print sheet (Print Sheet), or
        both (Bundled Deal). The render is produced by your own device; we provide the
        software that drives it and the right to download the finished file.
      </p>

      <h2>2. Eligible refunds</h2>
      <p>We will issue a full refund in any of the following situations:</p>
      <ul>
        <li>
          <strong>Download failure.</strong> Payment succeeded but the download link did not
          unlock within 24 hours of payment confirmation.
        </li>
        <li>
          <strong>Defective output.</strong> The rendered file is corrupted, blank, or has a
          measurable deviation from the spec we publish in the Studio (e.g., wrong dimensions,
          wrong head height, wrong background color).
        </li>
        <li>
          <strong>Duplicate charge.</strong> Stripe accidentally charged you twice for the same
          render.
        </li>
        <li>
          <strong>Within 14 days, file not downloaded.</strong> If you have not yet downloaded
          either deliverable from the order, you can cancel for any reason within 14 days of
          purchase.
        </li>
        <li>
          <strong>Mandatory consumer-protection law.</strong> Where local law (e.g., EU
          Directive 2011/83/EU as transposed nationally) gives you a withdrawal right beyond
          this policy, that right prevails.
        </li>
      </ul>

      <h2>3. Non-eligible refunds</h2>
      <p>We cannot offer a refund in the following situations:</p>
      <ul>
        <li>
          <strong>Issuing-authority rejection</strong> for reasons not attributable to our
          render — including but not limited to: poor lighting in your source photo, an
          expression considered unsuitable, glasses or accessories obscuring the face, hair
          covering parts of the face, changes to the authority's published specifications
          after your purchase, or any biometric scoring outside our control.
        </li>
        <li>
          <strong>Change of mind after download.</strong> Once a deliverable in your order has
          been downloaded, refund eligibility ends for that deliverable (the Bundled Deal is
          treated as one purchase: downloading either file ends eligibility for the bundle).
        </li>
        <li>
          <strong>Charges initiated by chargeback abuse</strong>, where the cardholder did in
          fact authorize and complete the purchase. We will respond to chargebacks with the
          Stripe session log and metadata showing the successful render and download.
        </li>
      </ul>

      <h2>4. How to request a refund</h2>
      <ol>
        <li>
          Find your Stripe session ID — it appears on the <code>/success</code> page after
          payment and in the email receipt Stripe sent you.
        </li>
        <li>
          Email <a href="mailto:support@visapass.photo">support@visapass.photo</a> with that
          session ID and a brief description of the issue. If the problem is a defective file,
          attach the file or a screenshot.
        </li>
        <li>
          We typically respond within 2 business days. Approved refunds are processed via
          Stripe; the amount will appear back on your original payment method in roughly
          <strong>5 to 10 business days</strong>, depending on your card issuer.
        </li>
      </ol>

      <h2>5. Currency &amp; conversion</h2>
      <p>
        We charge in U.S. Dollars. Your bank may have converted the original charge into your
        local currency at the time of payment. Stripe always refunds the original USD amount;
        the value your bank credits back may differ slightly due to exchange-rate movement
        between the two transactions. We cannot reimburse the conversion difference.
      </p>

      <h2>6. Cancellation before payment</h2>
      <p>
        You can leave the embedded checkout page at any time before submitting payment. Stripe
        does not charge incomplete sessions. The Studio remembers your photo only while the
        browser tab stays open — closing the tab without paying simply ends the session.
      </p>

      <h2>7. Contact</h2>
      <p>
        Refund requests: <a href="mailto:support@visapass.photo">support@visapass.photo</a>.
        We aim to answer within 2 business days.
      </p>
    </>
  );
}
