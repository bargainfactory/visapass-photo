import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';

export const metadata: Metadata = { title: 'Terms of Service' };

const LAST_UPDATED = '2026-05-19';

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using VisaPass Photo (the "Service"), you agree to be bound by these
        Terms of Service ("Terms"). If you do not agree, do not use the Service. We may update
        these Terms from time to time; continued use after a change constitutes acceptance of
        the revised Terms.
      </p>

      <h2>2. The Service</h2>
      <p>
        VisaPass Photo is an in-browser tool that helps you generate passport and visa photos
        formatted to country-specific specifications. All image processing — facial-landmark
        detection, background removal, cropping, and color compositing — happens on your own
        device. We never receive or store your photographs on our servers. After payment, you
        download the rendered file from the same browser session that created it.
      </p>

      <h2>3. Accounts &amp; Eligibility</h2>
      <p>
        The Service does not require a user account. You must be at least the age of majority
        in your jurisdiction to make a purchase. If you are using the Service on behalf of an
        organization, you represent that you are authorized to bind that organization to these
        Terms.
      </p>

      <h2>4. Pricing &amp; Payment</h2>
      <p>
        Prices are listed in U.S. Dollars on the checkout page. Payment is collected by Stripe,
        Inc. and is governed by{' '}
        <a href="https://stripe.com/legal/consumer" target="_blank" rel="noopener noreferrer">
          Stripe's consumer terms
        </a>
        . By submitting payment information you authorize Stripe to charge the listed amount to
        your selected payment method (credit/debit card, Apple Pay, Google Pay, Link, or any
        other method shown). Taxes, foreign-exchange fees, or bank surcharges, if any, are your
        responsibility.
      </p>
      <p>
        Each purchase entitles you to a single render of the document you selected. Re-running
        the pipeline on a new upload constitutes a new render and requires a separate payment.
      </p>

      <h2>5. Compliance Disclaimer</h2>
      <p>
        We compute every output against the most recent public specifications we could verify
        for the issuing authority — head height, eye-line position, background color, dimensions,
        DPI. <strong>However, acceptance of a passport or visa photograph is determined solely
        by the issuing authority</strong>, not by us. Specifications change without notice, and
        the authority may reject any photograph for reasons outside our control (e.g., lighting,
        expression, glasses, hair covering the eyes). Use of the Service does not guarantee
        approval of any application.
      </p>

      <h2>6. Your Responsibilities</h2>
      <ul>
        <li>You will upload only photographs you have the right to use.</li>
        <li>
          You will provide accurate input (front-facing photo, even lighting, neutral expression,
          no obstructions) and follow the country-specific guidelines shown in the Studio.
        </li>
        <li>
          You will not use the Service to misrepresent your identity, commit fraud, or violate
          any applicable law.
        </li>
        <li>
          You will not attempt to reverse-engineer, scrape, or otherwise interfere with the
          Service or with Stripe's payment pages.
        </li>
      </ul>

      <h2>7. Intellectual Property</h2>
      <p>
        You retain all rights to the photographs you upload and to the rendered outputs you
        download. By using the Service, you grant us a limited, on-device, processing license
        sufficient to perform the operations the Service performs (face detection, background
        removal, cropping, compositing). That license terminates when the processing completes;
        no copy of your photograph is sent to or retained by us.
      </p>
      <p>
        The Service itself, including all software, design, and brand assets, is our property
        and is protected by applicable intellectual-property laws.
      </p>

      <h2>8. Refunds</h2>
      <p>
        Our refund policy is published at{' '}
        <a href="/legal/refunds">/legal/refunds</a> and is incorporated into these Terms by
        reference.
      </p>

      <h2>9. Warranty Disclaimer</h2>
      <p>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
        EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. We do not
        warrant that the Service will be uninterrupted, error-free, or that any rendered output
        will be accepted by any issuing authority.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, our aggregate liability arising out of or
        relating to your use of the Service will not exceed the amount you paid us in the
        twelve (12) months preceding the event giving rise to the claim. We will not be liable
        for indirect, incidental, special, consequential, or punitive damages, including lost
        profits, lost data, or rejected applications.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold us harmless from any claims arising out of your use of
        the Service, your violation of these Terms, or your violation of any rights of a third
        party, including any issuing authority.
      </p>

      <h2>12. Termination</h2>
      <p>
        We may suspend or terminate access to the Service at any time, with or without notice,
        for any reason — including suspected fraud, chargeback abuse, or violation of these
        Terms.
      </p>

      <h2>13. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction in which the Service operator
        is established, without regard to conflict-of-laws principles. Any dispute will be
        resolved in the courts of that jurisdiction unless mandatory consumer-protection law in
        your country of residence provides otherwise.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these Terms: <a href="mailto:legal@visapass.photo">legal@visapass.photo</a>.
      </p>
    </>
  );
}
