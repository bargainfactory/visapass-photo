/**
 * Country / document compliance specs.
 *
 * All measurements are physical (mm) — pixel calculations are derived at render time
 * using mmToPx(mm, dpi). headHeightRatio describes the proportion of the photo height
 * that the head (chin → crown) should occupy.
 *
 * Sources: ICAO 9303, US Dept of State, UK HM Passport Office, Schengen 2003/693/EC,
 * IRCC Canada, Australian DFAT, Indian MEA, JP MOFA, CN NIA, etc.
 *
 * For each entry — values reflect the most recent public specifications at the time
 * of authoring. Always verify with the issuing authority for production use.
 */
export type DocumentType = 'passport' | 'visa' | 'id_card' | 'driver_license';
export type GlassesPolicy = 'forbidden' | 'allowed_no_glare' | 'medical_only';
export type ExpressionPolicy = 'neutral' | 'neutral_or_natural_smile';

export interface CountrySpec {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** English country name */
  name: string;
  /** Flag emoji */
  flag: string;
  documents: DocumentSpec[];
}

export interface DocumentSpec {
  id: string;
  type: DocumentType;
  label: string;
  /** Final photo width in mm. */
  widthMm: number;
  /** Final photo height in mm. */
  heightMm: number;
  /** Head height (chin → top of head) as a ratio of photo height. e.g. [0.50, 0.69]. */
  headHeightRatio: [number, number];
  /**
   * Vertical position of the eye line measured from the BOTTOM of the photo,
   * as a ratio of photo height. Many specs target eye line between ~55-71% from bottom.
   */
  eyeLineFromBottom: [number, number];
  /**
   * Optional exact head height (chin → crown) in millimetres. Overrides
   * headHeightRatio when set — used by countries that specify an absolute
   * head measurement (e.g. US passport: 34 mm).
   */
  headHeightMm?: number;
  /**
   * Optional exact distance from the top of the photo to the crown of the head,
   * in millimetres. Overrides eyeLineFromBottom positioning when set — the crop
   * is anchored on the crown rather than the eye line.
   */
  crownFromTopMm?: number;
  /**
   * When true, the 4×6 print sheet is paired with a back-of-sheet certification
   * template (signature line, "I certify this to be a true likeness of …",
   * live date). Required by Canada — the guarantor signs the back of one print.
   */
  requiresBackTemplate?: boolean;
  /** Background hex color (sRGB). */
  background: string;
  /** Glasses policy. */
  glasses: GlassesPolicy;
  expression: ExpressionPolicy;
  /** Recommended print DPI for physical reproduction. */
  dpi: number;
  notes?: string[];
}

export const COUNTRIES: CountrySpec[] = [
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    documents: [
      {
        id: 'us-passport',
        type: 'passport',
        label: 'US Passport (2×2 in)',
        widthMm: 51,
        heightMm: 51,
        // 34 mm head height inside a 51 mm photo == ratio of 0.667 (kept in
        // sync with headHeightMm so the existing ratio-based UI badges read
        // sensibly even though crown anchoring is what actually positions).
        headHeightRatio: [0.667, 0.667],
        eyeLineFromBottom: [0.56, 0.69],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral_or_natural_smile',
        dpi: 300,
        notes: [
          '2×2 inches (51×51 mm), plain white background',
          'No glasses (effective Nov 1, 2016)',
          '3 mm gap from top of photo to crown of head',
          'Head measures exactly 34 mm from crown to chin',
          'Remaining 14 mm below chin shows shoulders & upper body',
        ],
      },
      {
        id: 'us-visa',
        type: 'visa',
        label: 'US Visa (2×2 in)',
        widthMm: 51,
        heightMm: 51,
        headHeightRatio: [0.667, 0.667],
        eyeLineFromBottom: [0.56, 0.69],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral_or_natural_smile',
        dpi: 300,
        notes: [
          '2×2 inches (51×51 mm), plain white background',
          '3 mm gap from top of photo to crown of head',
          'Head measures exactly 34 mm from crown to chin',
          'Remaining 14 mm below chin shows shoulders & upper body',
        ],
      },
    ],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    documents: [
      {
        id: 'gb-passport',
        type: 'passport',
        label: 'UK Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.65, 0.75],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 32,
        crownFromTopMm: 3,
        background: '#F4F4F2',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
        notes: ['Light grey or cream background', 'No smiling, mouth closed'],
      },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    documents: [
      {
        id: 'ca-passport',
        type: 'passport',
        label: 'Canada Passport (50×70 mm)',
        widthMm: 50,
        heightMm: 70,
        // Tightened to IRCC's upper-half: targets 35.5 mm head height so
        // ±0.5 mm landmark variance still lands inside the 35-36 mm window
        // the user specified. headHeightRatio is kept for UI badge display
        // only — Canada crops crown-anchored so headHeightMm wins.
        headHeightRatio: [0.5, 0.514],
        eyeLineFromBottom: [0.55, 0.67],
        headHeightMm: 35.5,
        crownFromTopMm: 17.5,
        requiresBackTemplate: true,
        background: '#FFFFFF',
        glasses: 'allowed_no_glare',
        expression: 'neutral',
        dpi: 300,
        notes: [
          '50×70 mm, plain white or light background',
          'Head height calibrated to 35.5 mm (within IRCC 35-36 mm target)',
          '17.5 mm above the crown, 17 mm below the chin for shoulders',
          'Back of one photo includes guarantor certification template',
        ],
      },
    ],
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    documents: [
      {
        id: 'au-passport',
        type: 'passport',
        label: 'Australia Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        // Match the UK passport's cropping configuration: 32 mm head height
        // crown-to-chin, anchored 3 mm below the top of the photo, with the
        // 0.65-0.75 head-height ratio range. Background stays white per the
        // Australian DFAT spec — only the geometric values are unified.
        headHeightRatio: [0.65, 0.75],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 32,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'DE',
    name: 'Germany (Schengen)',
    flag: '🇩🇪',
    documents: [
      {
        id: 'de-passport',
        type: 'passport',
        label: 'Schengen / Germany (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#E7E7E5',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
        notes: ['Light grey background recommended', 'Strict ICAO compliance'],
      },
    ],
  },
  {
    code: 'FR',
    name: 'France (Schengen)',
    flag: '🇫🇷',
    documents: [
      {
        id: 'fr-passport',
        type: 'passport',
        label: 'France Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.71, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#E7E7E5',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'IT',
    name: 'Italy (Schengen)',
    flag: '🇮🇹',
    documents: [
      {
        id: 'it-passport',
        type: 'passport',
        label: 'Italy Passport (35×40 mm)',
        widthMm: 35,
        heightMm: 40,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 30,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'allowed_no_glare',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'ES',
    name: 'Spain (Schengen)',
    flag: '🇪🇸',
    documents: [
      {
        id: 'es-passport',
        type: 'passport',
        label: 'Spain Passport (32×26 mm)',
        widthMm: 32,
        heightMm: 26,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 19,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'NL',
    name: 'Netherlands (Schengen)',
    flag: '🇳🇱',
    documents: [
      {
        id: 'nl-passport',
        type: 'passport',
        label: 'Netherlands Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'CH',
    name: 'Switzerland',
    flag: '🇨🇭',
    documents: [
      {
        id: 'ch-passport',
        type: 'passport',
        label: 'Switzerland Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.71, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'allowed_no_glare',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    documents: [
      {
        id: 'in-passport',
        type: 'passport',
        label: 'India Passport (2×2 in)',
        widthMm: 51,
        heightMm: 51,
        headHeightRatio: [0.6, 0.75],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'allowed_no_glare',
        expression: 'neutral',
        dpi: 300,
        notes: ['2×2 inch with white background', 'Face must cover 70-80% of photo'],
      },
      {
        id: 'in-visa',
        type: 'visa',
        label: 'India e-Visa (2×2 in)',
        widthMm: 51,
        heightMm: 51,
        headHeightRatio: [0.6, 0.75],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'allowed_no_glare',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'CN',
    name: 'China',
    flag: '🇨🇳',
    documents: [
      {
        id: 'cn-visa',
        type: 'visa',
        label: 'China Visa (33×48 mm)',
        widthMm: 33,
        heightMm: 48,
        headHeightRatio: [0.6, 0.75],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 30,
        crownFromTopMm: 2,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
        notes: ['White background only', 'Head 15–22 mm wide, 28–33 mm tall'],
      },
    ],
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    documents: [
      {
        id: 'jp-passport',
        type: 'passport',
        label: 'Japan Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'KR',
    name: 'South Korea',
    flag: '🇰🇷',
    documents: [
      {
        id: 'kr-passport',
        type: 'passport',
        label: 'South Korea Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'BR',
    name: 'Brazil',
    flag: '🇧🇷',
    documents: [
      {
        id: 'br-passport',
        type: 'passport',
        label: 'Brazil Passport (5×7 cm)',
        widthMm: 50,
        heightMm: 70,
        headHeightRatio: [0.5, 0.6],
        eyeLineFromBottom: [0.55, 0.67],
        background: '#FFFFFF',
        glasses: 'allowed_no_glare',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'MX',
    name: 'Mexico',
    flag: '🇲🇽',
    documents: [
      {
        id: 'mx-passport',
        type: 'passport',
        label: 'Mexico Passport (4.5×3.5 cm)',
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
  },
  {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    documents: [
      {
        id: 'za-passport',
        type: 'passport',
        label: 'South Africa Passport (35×45 mm)',
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
  },
  {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    documents: [
      {
        id: 'sg-passport',
        type: 'passport',
        label: 'Singapore Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    documents: [
      {
        id: 'ae-visa',
        type: 'visa',
        label: 'UAE Visa (4.3×5.5 cm)',
        widthMm: 43,
        heightMm: 55,
        headHeightRatio: [0.65, 0.78],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 40,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    flag: '🇳🇿',
    documents: [
      {
        id: 'nz-passport',
        type: 'passport',
        label: 'New Zealand Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        background: '#FFFFFF',
        glasses: 'allowed_no_glare',
        expression: 'neutral_or_natural_smile',
        dpi: 300,
      },
    ],
  },
  {
    code: 'TR',
    name: 'Türkiye',
    flag: '🇹🇷',
    documents: [
      {
        id: 'tr-passport',
        type: 'passport',
        label: 'Türkiye Passport (50×60 mm)',
        widthMm: 50,
        heightMm: 60,
        headHeightRatio: [0.65, 0.78],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 43,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
  {
    code: 'RU',
    name: 'Russia',
    flag: '🇷🇺',
    documents: [
      {
        id: 'ru-passport',
        type: 'passport',
        label: 'Russia Passport (35×45 mm)',
        widthMm: 35,
        heightMm: 45,
        headHeightRatio: [0.7, 0.8],
        eyeLineFromBottom: [0.55, 0.7],
        headHeightMm: 34,
        crownFromTopMm: 3,
        background: '#FFFFFF',
        glasses: 'forbidden',
        expression: 'neutral',
        dpi: 300,
      },
    ],
  },
];

export function findDocument(documentId: string) {
  for (const country of COUNTRIES) {
    const doc = country.documents.find((d) => d.id === documentId);
    if (doc) return { country, doc };
  }
  return null;
}

export function midpoint(range: [number, number]) {
  return (range[0] + range[1]) / 2;
}
