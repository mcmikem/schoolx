/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,jsx,tsx,mdx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          brightest: 'var(--surface-brightest)',
          bright: 'var(--surface-bright)',
          dim: 'var(--surface-dim)',
          container: 'var(--surface-container)',
          'container-high': 'var(--surface-container-high)',
          'container-highest': 'var(--surface-container-highest)',
          'container-low': 'var(--surface-container-low)',
          'container-lowest': 'var(--surface-container-lowest)',
          lowest: 'var(--surface-lowest)',
        },
        onSurface: {
          DEFAULT: 'var(--on-surface)',
          variant: 'var(--on-surface-variant)',
        },
        outline: {
          DEFAULT: 'var(--outline)',
          variant: 'var(--outline-variant)',
        },
        background: 'var(--background)',
        'on-background': 'var(--on-background)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'on-primary': 'var(--on-primary)',
        'on-secondary': 'var(--on-secondary)',
        error: 'var(--error)',
        // Material-3 roles, aliased onto the soft/ink token family in
        // globals.css. See the "Material-3 role aliases" block there.
        secondary: {
          DEFAULT: 'var(--secondary)',
          container: 'var(--secondary-container)',
        },
        'on-secondary-container': 'var(--on-secondary-container)',
        tertiary: {
          DEFAULT: 'var(--tertiary)',
          container: 'var(--tertiary-container)',
        },
        'on-tertiary-container': 'var(--on-tertiary-container)',
        'error-container': 'var(--error-container)',
        'on-error-container': 'var(--on-error-container)',
        green: {
          DEFAULT: 'var(--green)',
          soft: 'var(--green-soft)',
        },
        amber: {
          DEFAULT: 'var(--amber)',
          soft: 'var(--amber-soft)',
        },
        red: 'var(--red)',
        blue: {
          DEFAULT: 'var(--blue)',
          soft: 'var(--blue-soft)',
        },
      },
      backgroundColor: {
        surface: {
          DEFAULT: 'var(--surface)',
          brightest: 'var(--surface-brightest)',
          bright: 'var(--surface-bright)',
          dim: 'var(--surface-dim)',
          container: 'var(--surface-container)',
          'container-low': 'var(--surface-container-low)',
          'container-lowest': 'var(--surface-container-lowest)',
          lowest: 'var(--surface-lowest)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        outline: 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',
      },
      textColor: {
        // These must keep their object shape. A bare string here replaces the
        // whole scale inherited from `colors`, which silently killed
        // text-primary-600/700/800 and text-on-surface (65 call sites).
        onSurface: {
          DEFAULT: 'var(--on-surface)',
          variant: 'var(--on-surface-variant)',
        },
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        primary: {
          DEFAULT: 'var(--primary)',
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
      },
      fontFamily: {
        headline: ['Sora', 'sans-serif'],
        heading: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        label: ['DM Sans', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
      },
      boxShadow: {
        'xl': '0 10px 40px -4px rgba(0, 32, 69, 0.06)',
        '2xl': '0 24px 48px -12px rgba(0, 32, 69, 0.06)',
        'primary': '0 8px 16px -4px rgba(0, 32, 69, 0.1)',
      },
    },
  },
  plugins: [],
}