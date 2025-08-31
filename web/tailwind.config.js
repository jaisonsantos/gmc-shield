/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: 'var(--accent, #6b46c1)',
        fg: 'var(--fg, #111827)',
        muted: 'var(--muted, #6b7280)',
        line: 'var(--line, #e5e7eb)',
        bg: 'var(--bg, #ffffff)'
      },
    },
  },
  plugins: [],
}
