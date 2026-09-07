const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, 'src/app/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, 'src/components/**/*.{js,ts,jsx,tsx,mdx}'),
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './frontend/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          500: '#00A343',
          600: '#008A38',
          700: '#006C2C',
        },
        sidebar: '#F9FAFB',
        border: '#E5E7EB',
        card: '#FFFFFF',
        accentAmber: {
          bg: '#FEF3C7',
          text: '#D97706',
          border: '#FDE68A',
        },
        accentGreen: {
          bg: '#E8F5E9',
          text: '#008A38',
          border: '#A7F3D0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
