import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        ring: 'hsl(var(--ring))',
        ink: {
          DEFAULT: 'hsl(var(--ink))',
          light: 'hsl(var(--ink-light))',
          dark: 'hsl(var(--ink-dark))',
          wash: 'hsl(var(--ink-wash))',
        },
        paper: {
          DEFAULT: 'hsl(var(--paper))',
          ivory: 'hsl(var(--paper-ivory))',
          rice: 'hsl(var(--paper-rice))',
        },
        seal: {
          DEFAULT: 'hsl(var(--seal))',
          red: 'hsl(var(--seal-red))',
        },
        landscape: {
          green: 'hsl(var(--landscape-green))',
          mist: 'hsl(var(--landscape-mist))',
        },
        jade: {
          DEFAULT: 'hsl(var(--jade-accent))',
          soft: 'hsl(var(--jade-soft))',
        },
        peach: {
          DEFAULT: 'hsl(var(--peach-accent))',
          soft: 'hsl(var(--peach-soft))',
        },
        sky: {
          DEFAULT: 'hsl(var(--sky-accent))',
          soft: 'hsl(var(--sky-soft))',
        },
        gold: {
          accent: 'hsl(var(--gold-accent))',
        },
      },
      fontFamily: {
        'cursive-title': ['var(--font-cursive-title)', 'cursive'],
        'running-script': ['var(--font-running-script)', 'cursive'],
        'semi-cursive': ['var(--font-semi-cursive)', 'cursive'],
        kaishu: ['var(--font-kaishu)', 'serif'],
        seal: ['var(--font-seal)', 'cursive'],
        'serif-fallback': ['var(--font-serif-fallback)', 'serif'],
        sans: [
          'var(--font-sans)',
          'Plus Jakarta Sans',
          'system-ui',
          'sans-serif',
        ],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        hard: '6px 6px 0 hsl(var(--border))',
        'hard-sm': '3px 3px 0 hsl(var(--border))',
        'hard-lg': '10px 10px 0 hsl(var(--border))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        pop: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-3px) scale(1.02)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-2deg)' },
          '75%': { transform: 'rotate(2deg)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        breathe: 'breathe 2s ease-in-out infinite',
        pop: 'pop 1.8s ease-in-out infinite',
        wiggle: 'wiggle 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
