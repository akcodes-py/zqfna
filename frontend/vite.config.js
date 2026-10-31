import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/lucide-react")) return "icons";
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      "^/(api|health)": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
