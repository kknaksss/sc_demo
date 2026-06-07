import type { Config } from "tailwindcss";

// SC-WP-01 C3 — Tailwind 설정 (skeleton). 디자인 토큰은 후속 WP(claude-design/onto).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
