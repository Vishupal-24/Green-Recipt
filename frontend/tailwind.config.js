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
      },
      // 3. New Animations (For Infinite Scroll & Blobs)
      keyframes: {
        scroll: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
      },
      animation: {
        scroll: 'scroll 30s linear infinite',
        blob: "blob 7s infinite",
      },
    },
  },
  plugins: [],
}