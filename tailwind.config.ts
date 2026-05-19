import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcd9ff',
          300: '#8ebfff',
          400: '#599aff',
          500: '#3578f5',
          600: '#1f5be0',
          700: '#1b48b5',
          800: '#1c3e90',
          900: '#1c3673',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        // Used by the international flag band in the site header. The flag
        // row is rendered twice end-to-end and slid −50% so the marquee
        // loops seamlessly.
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2.4s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        marquee: 'marquee 60s linear infinite',
      },
      backgroundImage: {
        'mesh-light':
          'radial-gradient(at 20% 10%, hsl(214 100% 96%) 0px, transparent 50%), radial-gradient(at 80% 0%, hsl(220 100% 95%) 0px, transparent 50%), radial-gradient(at 90% 80%, hsl(213 80% 92%) 0px, transparent 50%)',
        'mesh-dark':
          'radial-gradient(at 20% 10%, hsl(217 91% 18%) 0px, transparent 50%), radial-gradient(at 80% 0%, hsl(220 70% 14%) 0px, transparent 50%), radial-gradient(at 90% 80%, hsl(213 60% 12%) 0px, transparent 50%)',
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
};

export default config;
