/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec3ff',
          400: '#59a1ff',
          500: '#337dff',
          600: '#1b5cf5',
          700: '#1547e1',
          800: '#183cb6',
          900: '#19378f',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#e0e4ea',
          300: '#c5ccd6',
          400: '#98a2b3',
          500: '#6b7787',
          600: '#4a5568',
          700: '#374151',
          800: '#242b38',
          900: '#161b24',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'Inter', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.06)',
      },
    },
  },
  plugins: [],
};
