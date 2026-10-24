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
          bg: "#FAFAF7",
          surface: "#FFFFFF",
          border: "#ECEBE6",
          text: {
            primary: "#1F2937",
            secondary: "#6B7280",
            muted: "#9CA3AF",
          },
          sage: {
            DEFAULT: "#8FB8A0",
            hover: "#5E8F73",
            light: "#EAF2ED",
            soft: "#D4E5DB",
          },
          blush: {
            DEFAULT: "#F6E7E0",
            hover: "#EAC4B5",
            light: "#FDF7F4",
          },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 10px -2px rgba(0, 0, 0, 0.04), 0 1px 3px -1px rgba(0, 0, 0, 0.02)",
        card: "0 4px 20px -4px rgba(31, 41, 55, 0.05)",
      },
    },
  },
  plugins: [],
};
