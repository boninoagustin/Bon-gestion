import { configDefaults, defineConfig } from 'vitest/config';

// Test only this application, not bundled/nested projects or build artifacts.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'dist_electron/**', 'android/**'],
  },
});
