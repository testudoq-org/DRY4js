import { describe, it, expect } from 'vitest';
import { validateDetection } from '../src/validator.mjs';
import { runCli } from '../src/cli.mjs';

describe('validation runner', () => {
  it('returns a complete validation summary', () => {
    const summary = validateDetection({ metric: 'jaccard' });

    expect(summary.totalCases).toBeGreaterThan(0);
    expect(summary.details.length).toBe(summary.totalCases);
    expect(summary.precision).toBeGreaterThanOrEqual(0);
    expect(summary.recall).toBeGreaterThanOrEqual(0);
    expect(summary.accuracy).toBeGreaterThanOrEqual(0);
  });

  it('supports adaptive threshold mode', () => {
    const summary = validateDetection({ metric: 'jaccard', adaptiveThreshold: true });

    expect(summary.configuration.adaptiveThreshold).toBe(true);
    expect(summary.details.length).toBe(summary.totalCases);
  });
});

describe('CLI validate mode', () => {
  it('returns validation results when --validate is passed', async () => {
    const result = await runCli(['node', 'dry4js', '--validate']);

    expect(result).toBeTruthy();
    expect(result.validation).toBeDefined();
    expect(result.validation.totalCases).toBeGreaterThan(0);
    expect(result.exitCode).toBeGreaterThanOrEqual(0);
  });
});
