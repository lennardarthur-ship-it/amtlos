import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Datenbank-Tests teilen sich eine Testdatenbank je Datei; nicht parallel innerhalb der Datei
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
