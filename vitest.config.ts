import { baseVitestConfig } from '@cult-frog/tooling/vitest/base';

export default baseVitestConfig({
  aliasName: '@cult-frog/random',
  testOverrides: {
    typecheck: { enabled: true, include: ['src/**/*.test-d.ts'] },
  },
});
