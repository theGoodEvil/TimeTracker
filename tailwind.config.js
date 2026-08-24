const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  safelist: [
    'pb-safe',
    // Reminder toast classes built dynamically by app/static/idle.js
    // (file is not in tailwind content scan; safelist guarantees they ship)
    { pattern: /^bg-(blue|purple|green|amber)-(100|200|300|600|700|800|900)$/, variants: ['hover', 'dark', 'dark:hover'] },
    { pattern: /^bg-(blue|purple|green|amber)-900\/30$/, variants: ['dark'] },
    { pattern: /^text-(blue|purple|green|amber)-(100|300|700|900)$/, variants: ['dark'] },
    { pattern: /^border-(blue|purple|green|amber)-(300|700)$/, variants: ['dark'] },
  ],
  content: [
    './app/templates/**/*.html',
    './app/static/src/**/*.js',
    './app/static/idle.js',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          // EvilTime primary green
          50: '#f2f9f4',
          100: '#e1f1e5',
          200: '#c4e3cb',
          300: '#9bd0a7',
          400: '#78bd87',
          500: '#64b376',
          600: '#4e965f',
          700: '#40784e',
          800: '#365f41',
          900: '#2e4f37',
          950: '#172b1d',
          DEFAULT: '#64b376',
          // Back-compat for `hover:bg-primary-dark` etc.
          dark: '#4e965f',
        },
        secondary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#9bd0a7',
          600: '#06b6d4',
          700: '#0891b2',
          800: '#0e7490',
          900: '#155e75',
          DEFAULT: '#9bd0a7',
          dark: '#06b6d4',
        },
        // Semantic colors
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          DEFAULT: '#10b981',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          DEFAULT: '#f59e0b',
        },
        danger: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          DEFAULT: '#ef4444',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          DEFAULT: '#3b82f6',
        },

        // Neutrals (slate-based) + compatibility aliases used throughout templates
        'background-light': '#f8fafc', // slate-50
        'background-dark': '#0b1220', // deep slate-ish
        'card-light': '#ffffff',
        'card-dark': '#0f172a', // slate-900
        'text-light': '#0f172a', // slate-900
        'text-dark': '#e2e8f0', // slate-200
        'text-muted-light': '#64748b', // slate-500
        'text-muted-dark': '#94a3b8', // slate-400
        'border-light': '#e2e8f0', // slate-200
        'border-dark': '#334155', // slate-700
      },
      borderRadius: {
        // Additive tokens (avoid overriding Tailwind defaults)
        tt: '0.75rem',
        'tt-lg': '1rem',
        'tt-xl': '1.25rem',
      },
      boxShadow: {
        // Additive tokens (avoid overriding Tailwind defaults)
        'tt-soft': '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 6px rgba(15, 23, 42, 0.06)',
        'tt-card': '0 1px 2px rgba(15, 23, 42, 0.06), 0 6px 18px rgba(15, 23, 42, 0.08)',
        'tt-lifted': '0 10px 25px rgba(15, 23, 42, 0.14), 0 4px 10px rgba(15, 23, 42, 0.08)',
      },
      spacing: {
        // Additive tokens (avoid overriding Tailwind defaults)
        'tt-xs': '0.375rem',
        'tt-sm': '0.625rem',
        'tt-md': '0.875rem',
        'tt-lg': '1.125rem',
        'tt-xl': '1.375rem',
      },
    },
  },
  plugins: [],
}
