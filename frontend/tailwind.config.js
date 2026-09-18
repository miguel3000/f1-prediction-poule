/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1: {
          // Primary accent — flat signal yellow, sourced from real 1996-2002
          // FOM broadcast timing graphics (position badges, gaps, lap times).
          // Flat only: this era never used gradients or glow.
          yellow: {
            50:  '#FFFBEA',
            100: '#FFF3C4',
            200: '#FFE58A',
            300: '#FFDA4D',
            400: '#FFD11F',
            500: '#FFCC00',
            600: '#D9AD00',
            700: '#B38F00',
            800: '#8C6F00',
            900: '#665200',
            950: '#403300',
          },
          neutral: {
            50:  '#FAFAFA',
            100: '#F0F0F0',
            200: '#D4D4D4',
            300: '#AAAAAA',
            400: '#777777',
            500: '#5C5860',
            600: '#413E44',
            700: '#302D32',
            800: '#2A2427',
            850: '#1F1A1D',
            900: '#191517',
            950: '#121012',
          },
          // Secondary accent — the period's own "qualifying gap" light blue
          // (fan-confirmed alongside the yellow race-gap color). Sprint/info
          // content uses this instead of yellow, same convention as the era.
          teal: {
            50:  '#EAFBFE',
            100: '#CEF5FC',
            200: '#9EEBFA',
            300: '#6FE0F4',
            400: '#5FD4E8',
            500: '#33B9D6',
            600: '#2394AD',
            700: '#1D7488',
            800: '#1A5C6D',
            900: '#184C5A',
            950: '#0B2D38',
          },
          white: '#FFFFFF',
          gray:  '#5C5860',
          // Team colors kept
          mercedes: '#00D2BE',
          ferrari:  '#DC0000',
          redbull:  '#0600EF',
          mclaren:  '#FF8700',
          orange:   '#FF8700',
        }
      },
      fontFamily: {
        'sans': ['Saira', 'Arial', 'sans-serif'],
        // Condensed geometric grotesque — closest faithful match to the
        // Eurostile/Microgramma family used across the 1996-2002 broadcast
        // graphics researched for this redesign (Eurostile itself is a
        // commercial font; this substitutes a free equivalent).
        'f1':   ['"Big Shoulders Display"', 'Saira', 'Arial', 'sans-serif'],
        // Badge/number face — used sparingly for position numbers and
        // short labels, matching the era's squared-terminal look.
        'f1-badge': ['Michroma', '"Big Shoulders Display"', 'sans-serif'],
        'mono': ['"Courier New"', 'Courier', 'monospace'],
      },
      fontSize: {
        'display-xl':  ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-2xl': ['4.5rem', { lineHeight: '1',   letterSpacing: '-0.02em' }],
        'body-compact': ['0.875rem', { lineHeight: '1.25' }],
      },
      // No glow tokens: the 1996-2002 broadcast look this redesign follows
      // is flat panels only — no gradients, no glow, no rounded corners.
      boxShadow: {
        'card':       '0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.4)',
        'card-hover': '0 10px 15px -3px rgba(0,0,0,0.6), 0 4px 6px -2px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
