/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        lavender: 'var(--c-lavender)',
        gold: 'var(--c-gold)',
        ivory: 'var(--c-ivory)',
        mist: 'var(--c-mist)',
        plum: 'var(--c-plum)',
        ink: 'var(--c-ink)',
        soft: 'var(--c-ink-soft)',
      },
      fontFamily: {
        sans: ['Manrope', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
}
