import { defineConfig } from 'tsdown'

/** Bundle Electron's main and preload entries while keeping the runtime-provided Electron module external. */
export default defineConfig([
  {
    entry: { main: 'src/main.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: true,
    deps: { neverBundle: ['electron'] },
  },
  {
    entry: {
      preload: 'src/preload.ts',
      'web-preload': 'src/web-preload.ts',
      'overlay-preload': 'src/overlay-preload.ts',
    },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: true,
    dts: false,
    clean: false,
    deps: { neverBundle: ['electron'] },
    checks: { legacyCjs: false },
  },
])
