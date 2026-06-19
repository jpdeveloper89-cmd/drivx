import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#09090b',
        card: '#111113',
        'section-alt': '#0f0f11',
        border: '#27272a',
        text: '#fafafa',
        muted: '#a1a1aa',
        accent: '#6366f1',
        'accent-secondary': '#22d3ee',
        'accent-violet': '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      boxShadow: {
        accent: '0 0 24px rgba(99,102,241,0.15)',
        'accent-lg': '0 0 36px rgba(99,102,241,0.2)',
      },
    },
  },
  plugins: [],
};

export default config;
