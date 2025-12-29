// /** @type {import('tailwindcss').Config} */
// export default {
//   content: [
//     "./index.html",
//     "./src/**/*.{js,ts,jsx,tsx}",
//   ],
//   theme: {
//     extend: {
//       // 1. This matches your Google Font import
//       fontFamily: {
//         sans: ['"Plus Jakarta Sans"', 'sans-serif'],
//       },
//       // 2. These match the hex codes you defined in the HTML script tag
//       colors: {
//         primary: '#10B981',      // Emerald-500
//         primaryDark: '#059669',  // Emerald-600
//         secondary: '#0F172A',    // Slate-900 (Navy)
//         lightbg: '#F8FAFC',      // Slate-50
//         neutral: '#475569',      // Slate-600
//       }
//     },
//   },
//   plugins: [],
// }

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      // 1. Your Custom Fonts
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      // 2. Your Custom Colors
      colors: {
        primary: '#10B981',      // Emerald-500
        primaryDark: '#059669',  // Emerald-600
        secondary: '#0F172A',    // Slate-900 (Navy)
        lightbg: '#F8FAFC',      // Slate-50
        neutral: '#475569',      // Slate-600
        // Dark mode specific colors
        dark: {
          bg: '#0f0f12',           // Deep dark background
          card: '#18181b',         // Card background
          surface: '#1f1f24',      // Elevated surface
          border: '#2a2a30',       // Border color
          hover: '#27272a',        // Hover state
          muted: '#71717a',        // Muted text
          accent: '#10b981',       // Accent (emerald)
        }
      },
      // 3. New Animations (For Infinite Scroll & Blobs & Theme)
      keyframes: {
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        scroll: 'scroll 30s linear infinite',
        blob: "blob 7s infinite",
        shimmer: 'shimmer 2s infinite',
        glow: 'glow 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      // Dark mode transitions
      transitionProperty: {
        'theme': 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform',
      },
    },
  },
  plugins: [],
}