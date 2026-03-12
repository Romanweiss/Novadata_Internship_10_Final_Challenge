/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope"', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px -20px rgba(15, 23, 42, 0.35)',
        card: '0 8px 24px -18px rgba(15, 23, 42, 0.42)',
      },
      borderRadius: {
        xl2: '1.15rem',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.65' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
