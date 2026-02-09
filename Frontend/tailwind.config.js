export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        display: ['Newsreader', 'Times New Roman', 'serif'],
      },
      colors: {
        brand: {
          50: '#e6f2f0',
          100: '#cfe5e1',
          200: '#a2c9c2',
          300: '#76aea3',
          400: '#4a9285',
          500: '#0f6b5f',
          600: '#0b4c44',
          700: '#093c36',
          800: '#072e2a',
          900: '#051f1d',
        },
        sand: {
          50: '#fbf7f2',
          100: '#f6efe6',
          200: '#efe5d8',
          300: '#e6d7c6',
          400: '#d7c2ad',
          500: '#c3a789',
          600: '#b48758',
          700: '#976a3d',
          800: '#6d4c2d',
          900: '#3f2a18',
        },
      },
      boxShadow: {
        soft: '0 12px 40px -24px rgba(19, 33, 45, 0.35)',
        card: '0 18px 60px -36px rgba(19, 33, 45, 0.35)',
      },
    },
  },
  plugins: [],
}
