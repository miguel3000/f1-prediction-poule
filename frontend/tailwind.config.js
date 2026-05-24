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
          // Primary F1 Red shades
          red: {
            50: '#FFE5E5',
            100: '#FFCCCC',
            200: '#FF9999',
            300: '#FF6666',
            400: '#FF3333',
            500: '#E10600',  // Main F1 Red
            600: '#B00500',
            700: '#8A0400',
            800: '#660300',
            900: '#4D0200',
            950: '#330100',
          },
          // Neutral/Surface colors (F1.com style)
          neutral: {
            50: '#FAFAFA',
            100: '#F5F5F5',
            200: '#E5E5E5',
            300: '#D4D4D4',
            400: '#A3A3A3',
            500: '#737373',
            600: '#525252',
            700: '#404040',
            800: '#262626',
            850: '#1A1A1A',
            900: '#15151E',  // Main background
            950: '#0A0A0F',
          },
          // Accent colors
          white: '#FFFFFF',
          gray: '#949498',
          // Team colors for future use
          mercedes: '#00D2BE',
          ferrari: '#DC0000',
          redbull: '#0600EF',
          mclaren: '#FF8700',
        }
      },
      fontFamily: {
        'sans': ['Saira', 'Arial', 'sans-serif'],
        'f1': ['"Formula1"', 'Saira', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-2xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'body-compact': ['0.875rem', { lineHeight: '1.25' }],
      },
      boxShadow: {
        'f1-glow': '0 0 20px rgba(225, 6, 0, 0.5)',
        'f1-glow-lg': '0 0 40px rgba(225, 6, 0, 0.6)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-red-black': 'linear-gradient(135deg, #E10600 0%, #15151E 100%)',
        'gradient-overlay': 'linear-gradient(180deg, transparent 0%, rgba(21, 21, 30, 0.8) 100%)',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite',
        'slide': 'slide 20s linear infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(225, 6, 0, 0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(225, 6, 0, 0.8)' },
        },
        slide: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      transitionDuration: {
        '300': '300ms',
      },
    },
  },
  plugins: [],
}
