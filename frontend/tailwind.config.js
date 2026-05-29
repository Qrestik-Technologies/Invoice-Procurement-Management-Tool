/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0C447C',
          hover: '#0a3a68',
          light: '#E8F0F8',
        },
        accent: {
          DEFAULT: '#0F6E56',
          light: '#E6F4F0',
        },
        surface: {
          DEFAULT: '#F8F9FC',
          card: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E5E7EB',
        },
        status: {
          draft: '#6B7280',
          pending: '#D97706',
          dispatched: '#2563EB',
          received: '#16A34A',
          overdue: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        drawer: '-4px 0 24px rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
};
