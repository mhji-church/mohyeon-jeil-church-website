import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  plugins: [tailwindcss(), vinext(), nitro()],
});
