import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-adaptive tokens (CSS vars defined in index.css for :root + .dark).
        // Alpha-enabled so `text-ink/50`, `bg-ink/5`, `border-ink/10` all work.
        ink:   'rgb(var(--ink) / <alpha-value>)',     // foreground (text/borders)
        paper: 'rgb(var(--paper) / <alpha-value>)',   // page/surface background
        brand: {
          dark:   '#0D1B2A',
          accent: '#162131',
          red:    '#E31E24',
          blue:   '#1A73E8',
          teal:   '#0D9488',
          amber:  '#F59E0B',
          purple: '#7C3AED',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [forms],
} satisfies Config
