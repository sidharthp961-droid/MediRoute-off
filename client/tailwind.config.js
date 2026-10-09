/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        police: {
          dark: '#070d1e',
          navy: '#0b162c',
          surface: '#112240',
          border: '#1d3557',
          card: '#0e1b33',
        },
        tactical: {
          blue: '#1d4ed8',
          cyan: '#0284c7',
          amber: '#f59e0b',
          crimson: '#e11d48',
          emerald: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        pulseSlow: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        flashFast: 'flash 0.8s ease-in-out infinite alternate',
      },
      keyframes: {
        flash: {
          '0%': { opacity: '0.4' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
