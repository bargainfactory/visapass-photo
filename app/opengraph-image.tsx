import { ImageResponse } from 'next/og';

// Single site-wide social card. Next.js serves this for both `og:image` and
// `twitter:image` (it falls back to opengraph-image when no twitter-image is
// defined). 1200×630 is the canonical Open Graph size.
export const alt = 'VisaPass Photo — Compliant passport & visa photos in seconds';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1c3673 0%, #1f5be0 55%, #3578f5 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            V
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>VisaPass Photo</div>
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          Compliant passport &amp; visa
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          photos in seconds
        </div>
        <div style={{ marginTop: 36, fontSize: 30, color: 'rgba(255,255,255,0.82)' }}>
          On-device AI · 50+ countries · Print &amp; digital ready
        </div>
      </div>
    ),
    size
  );
}
