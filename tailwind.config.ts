import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
        },
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        fg: {
          DEFAULT: "var(--fg)",
          muted: "var(--fg-muted)",
          subtle: "var(--fg-subtle)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          active: "var(--accent-active)",
          fg: "var(--accent-fg)",
          subtle: "var(--accent-subtle)",
          "subtle-hover": "var(--accent-subtle-hover)",
          border: "var(--accent-border)",
        },
        success: {
          DEFAULT: "var(--success)",
          text: "var(--success-text)",
          bg: "var(--success-bg)",
          border: "var(--success-border)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          text: "var(--warning-text)",
          bg: "var(--warning-bg)",
          border: "var(--warning-border)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          text: "var(--danger-text)",
          bg: "var(--danger-bg)",
          border: "var(--danger-border)",
        },
        info: {
          DEFAULT: "var(--info)",
          text: "var(--info-text)",
          bg: "var(--info-bg)",
          border: "var(--info-border)",
        },
        zebra: "var(--zebra)",
        overlay: "var(--overlay)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Skala baru lebih besar & lapang demi keterbacaan:
        // 12 · 13 · 14 · 15 · 17 · 21 · 25 · 31 · 38
        "2xs": ["12px", { lineHeight: "17px" }],
        xs: ["13px", { lineHeight: "19px" }],
        sm: ["14px", { lineHeight: "21px" }],
        base: ["15px", { lineHeight: "23px" }],
        lg: ["17px", { lineHeight: "25px" }],
        xl: ["21px", { lineHeight: "29px" }],
        "2xl": ["25px", { lineHeight: "32px" }],
        "3xl": ["31px", { lineHeight: "38px" }],
        "4xl": ["38px", { lineHeight: "44px" }],
      },
      borderRadius: {
        DEFAULT: "var(--radius-input)",
        sm: "var(--radius-input)",
        md: "var(--radius-input)",
        lg: "var(--radius-card)",
        xl: "var(--radius-card)",
        "2xl": "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        popover: "var(--shadow-popover)",
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
      },
      spacing: {
        // Skala 4px eksplisit sesuai spesifikasi
        4.5: "18px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(14px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pop: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-7px)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 200ms ease-out",
        rise: "rise 420ms cubic-bezier(0.16, 1, 0.3, 1) both",
        pop: "pop 200ms cubic-bezier(0.16, 1, 0.3, 1) both",
        float: "float 7s ease-in-out infinite",
        "gradient-pan": "gradient-pan 9s ease infinite",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
