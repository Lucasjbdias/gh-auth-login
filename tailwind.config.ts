import type { Config } from "tailwindcss";

// Identidade visual França Dias Group: azul institucional, vermelho, preto e
// dourado (prestígio). Tipografia Gadugi. Paleta refinada a partir do Manual
// da Marca — ajustável aos hex exatos em um único ponto.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Azul institucional (cor primária) — escala navy.
        brand: {
          50: "#eef3fb",
          100: "#d5e3f4",
          200: "#aec6e7",
          300: "#7ea3d4",
          400: "#4f7cbb",
          500: "#1f4f8f",
          600: "#163c70",
          700: "#102d57",
          800: "#0c2243",
          900: "#0a1b35",
        },
        // Cores institucionais de apoio.
        fd: {
          azul: "#1f4f8f",
          vermelho: "#c4122f",
          dourado: "#c9a24a",
          douradoClaro: "#e3c980",
          preto: "#0f1115",
        },
        // Cores semânticas dos alertas (Camada 6).
        alerta: {
          verde: "#16a34a",
          amarelo: "#eab308",
          laranja: "#ea580c",
          vermelho: "#dc2626",
        },
      },
      fontFamily: {
        sans: ["Gadugi", "var(--font-sans)", "system-ui", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        marca: "0 1px 3px rgba(10,27,53,0.08), 0 1px 2px rgba(10,27,53,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
