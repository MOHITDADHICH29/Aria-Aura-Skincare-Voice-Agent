/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: "#FAF9F6", // warm ivory
          surface: "#FFFFFF",
          border: "#E8E5DD", // warm separators
          text: {
            primary: "#252820",
            secondary: "#77786F",
            muted: "#9CA3AF",
          },
          sage: {
            DEFAULT: "#52775C", // deep sage
            hover: "#A3BDA7", // sage accent
            light: "#EDF2EB", // pale sage
            soft: "#F0E3DD", // soft blush
          },
          blush: {
            DEFAULT: "#F0E3DD",
            hover: "#A3BDA7",
            light: "#FAF9F6",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["'Plus Jakarta Sans'", "serif"],
      },
      boxShadow: {
        soft: "0 2px 10px -2px rgba(0, 0, 0, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.02)",
        card: "0 4px 20px -4px rgba(31, 41, 55, 0.05)",
      },
    },
  },
  plugins: [],
};
