/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0C447C',
        surface: '#F8F9FC',
        border: '#E5E7EB',
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
