/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-ink': '#2C3137',
        'vermilion': '#C7432F',
        'slate-gray': '#5B6B79',
        'paper-white': '#FAFAF9',
        'card-cream': '#F5F0E8',
        'success-ink': '#2D5A3D',
        'warning-amber': '#D97706',
        'error-crimson': '#DC2626',
      },
      fontFamily: {
        'display': ['Noto Serif SC', 'Source Han Serif SC', 'serif'],
        'body': ['Inter', '-apple-system', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      spacing: {
        '1': '0.5rem',  // 8px
        '2': '1rem',    // 16px
        '3': '1.5rem',  // 24px
        '4': '2rem',    // 32px
        '6': '3rem',    // 48px
        '8': '4rem',    // 64px
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0,0,0,0.08)',
        'md': '0 4px 8px rgba(0,0,0,0.12)',
        'lift': '0 8px 16px rgba(0,0,0,0.16)',
      },
      maxWidth: {
        'content': '1120px',
      },
    },
  },
  plugins: [],
}
