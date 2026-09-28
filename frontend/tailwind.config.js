/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.css',
  ],
  theme: {
    extend: {
      // Semantic colours from styles/identity.css; they switch with light and dark mode.
      colors: Object.fromEntries(
        ['danger', 'success', 'warning', 'info'].map((name) => [
          name,
          `rgb(var(--${name}) / <alpha-value>)`,
        ])
      ),
    },
  },
  plugins: [],
};
