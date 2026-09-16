/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Numbers use the UI font with tabular figures (see index.css)
        mono: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Codes: plates, VINs, part numbers, invoice numbers
        code: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Primary brand colour: a calm, deep blue instead of the default bright blue
        blue: {
          50: '#eff4fb',
          100: '#dbe6f5',
          200: '#bccfeb',
          300: '#8fb0dc',
          400: '#5e8bc9',
          500: '#3d6db4',
          600: '#2c5698',
          700: '#25467b',
          800: '#213c66',
          900: '#1f3455',
          950: '#142138',
        },
        gray: {
          50: '#f8f9fb',
          100: '#f1f3f6',
          200: '#e3e7ec',
          300: '#cdd3db',
          400: '#98a2b0',
          500: '#6b7585',
          600: '#4f5866',
          700: '#3a424e',
          800: '#252b34',
          900: '#161b22',
          950: '#0d1117',
        },
      },
      // Tight, consistent corner radii. No pill shapes.
      borderRadius: {
        none: '0',
        sm: '3px',
        DEFAULT: '4px',
        md: '5px',
        lg: '6px',
        xl: '6px',
        '2xl': '8px',
        '3xl': '8px',
      },
      // Subtle, flat shadows
      boxShadow: {
        sm: '0 1px 2px rgba(16, 24, 40, 0.04)',
        DEFAULT: '0 1px 2px rgba(16, 24, 40, 0.06)',
        md: '0 2px 4px rgba(16, 24, 40, 0.06)',
        lg: '0 4px 12px rgba(16, 24, 40, 0.08)',
        xl: '0 8px 24px rgba(16, 24, 40, 0.10)',
        '2xl': '0 12px 32px rgba(16, 24, 40, 0.12)',
        inner: 'inset 0 1px 2px rgba(16, 24, 40, 0.06)',
      },
      fontWeight: {
        // "black" is too heavy for a business app; cap it
        black: '700',
        extrabold: '650',
      },
    },
  },
  plugins: [],
}
