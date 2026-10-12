import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Placeholder Worker build (see cloudflare.config.ts). Resolves packages from the repository root.
export default defineConfig({ plugins: [cloudflare()] });
