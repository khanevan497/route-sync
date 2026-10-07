// Note: This file is referenced by shadcn/ui components.json but Tailwind v4 uses CSS-first config.
// The actual theme is defined in src/app/globals.css via @theme directive.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = {
  darkMode: ["class"] as const,
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8FAFC",
        surface: "#FFFFFF",
        primary: { DEFAULT: "#0F172A", foreground: "#FFFFFF" },
        accent: { DEFAULT: "#2563EB", foreground: "#FFFFFF" },
        success: { DEFAULT: "#16A34A", foreground: "#FFFFFF" },
        warning: { DEFAULT: "#D97706", foreground: "#FFFFFF" },
        danger: { DEFAULT: "#DC2626", foreground: "#FFFFFF" },
        border: "#E2E8F0",
        muted: { DEFAULT: "#64748B", foreground: "#64748B" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config;
