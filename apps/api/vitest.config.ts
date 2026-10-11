import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // swc statt esbuild: NestJS braucht emitDecoratorMetadata für die Dependency Injection
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: { fileParallelism: false, testTimeout: 30_000, hookTimeout: 60_000 },
});
