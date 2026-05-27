import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';

import { scanFiles } from '../src/scanner.mjs';
import { parseFile } from '../src/parser.mjs';
import { normalise } from '../src/normaliser.mjs';
import { fingerprint, countNodes } from '../src/fingerprinter.mjs';
import { findDuplicates } from '../src/comparator.mjs';
import { formatText, formatJson } from '../src/reporter.mjs';
import { DEFAULT_MIN_LINES, DEFAULT_MIN_NODES, DEFAULT_THRESHOLD, runCli } from '../src/cli.mjs';

let tmpDir;

function writeTmp(relPath, content) {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

function createSpinner() {
  return {
    text: '',
    warnings: [],
    successes: [],
    start() {
      return this;
    },
    warn(message) {
      this.warnings.push(message);
      return this;
    },
    succeed(message) {
      this.successes.push(message);
      return this;
    },
  };
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dryjs-cli-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runPipeline(filePaths, { threshold = 0.82, minLines = 4, minNodes = 20 } = {}) {
  const entries = [];

  for (const file of filePaths) {
    const forms = parseFile(file);
    for (const form of forms) {
      if (form.lineCount < minLines) continue;
      const normNode = normalise(form.node);
      const nodeTotal = countNodes(normNode);
      if (nodeTotal < minNodes) continue;
      entries.push({
        file: form.file,
        startLine: form.startLine,
        endLine: form.endLine,
        lineCount: form.lineCount,
        nodeCount: nodeTotal,
        fingerprints: fingerprint(normNode),
      });
    }
  }

  return {
    entries,
    pairs: findDuplicates(entries, { threshold }),
  };
}

describe('full pipeline identical structure detection', () => {
  it('finds a score of 1 for renamed identical functions', () => {
    const fileA = writeTmp('pipeline/alpha.js', [
      'function processAlpha(items) {',
      '  const filtered = items.filter(isValid);',
      '  const sorted = filtered.sort(byDate);',
      '  const mapped = sorted.map(transform);',
      '  return { count: mapped.length, data: mapped };',
      '}',
    ].join('\n'));

    const fileB = writeTmp('pipeline/beta.js', [
      'function processBeta(rows) {',
      '  const filtered = rows.filter(isValid);',
      '  const sorted = filtered.sort(byDate);',
      '  const mapped = sorted.map(transform);',
      '  return { count: mapped.length, data: mapped };',
      '}',
    ].join('\n'));

    const { pairs } = runPipeline([fileA, fileB], { threshold: 0.9, minLines: 4, minNodes: 10 });
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0].score).toBeCloseTo(1);
  });

  it('reports correct file and line metadata', () => {
    const fileA = writeTmp('meta/a.js', [
      '// preamble',
      'function doWork(x, y) {',
      '  const result = x + y;',
      '  return result * 2;',
      '}',
    ].join('\n'));

    const fileB = writeTmp('meta/b.js', [
      'function doTask(a, b) {',
      '  const result = a + b;',
      '  return result * 2;',
      '}',
    ].join('\n'));

    const { pairs } = runPipeline([fileA, fileB], { threshold: 0.5, minLines: 3, minNodes: 5 });
    expect(pairs.length).toBeGreaterThan(0);

    const pair = pairs[0];
    expect(pair.left.file).toBeTruthy();
    expect(pair.right.file).toBeTruthy();
    expect(pair.left.startLine).toBeGreaterThanOrEqual(1);
    expect(pair.right.startLine).toBeGreaterThanOrEqual(1);
  });
});

describe('full pipeline dissimilar code not flagged', () => {
  it('does not flag structurally different functions', () => {
    const fileA = writeTmp('dissimilar/a.js', [
      'function simple(x) {',
      '  return x * 2;',
      '}',
    ].join('\n'));

    const fileB = writeTmp('dissimilar/b.js', [
      'function complex(a, b, c, d) {',
      '  const temp = a + b;',
      '  if (temp > c) {',
      '    return temp * d + a - b;',
      '  }',
      '  return d * (a + b + c);',
      '}',
    ].join('\n'));

    const { pairs } = runPipeline([fileA, fileB], { threshold: 0.82, minLines: 3, minNodes: 5 });
    expect(pairs.length).toBe(0);
  });
});

describe('full pipeline filters', () => {
  it('excludes forms below minLines', () => {
    const file = writeTmp('filters/tiny.js', 'const x = () => 42;\n');
    const { entries } = runPipeline([file], { minLines: 4, minNodes: 1 });
    expect(entries.length).toBe(0);
  });

  it('excludes forms below minNodes', () => {
    const file = writeTmp('filters/small.js', [
      'function tiny(x) {',
      '  return x;',
      '}',
    ].join('\n'));

    const { entries } = runPipeline([file], { minLines: 1, minNodes: 100 });
    expect(entries.length).toBe(0);
  });
});

describe('full pipeline reporter integration', () => {
  it('formatText contains DUPLICATE for matched pairs', () => {
    const src = [
      'function workA(xs) {',
      '  const ys = xs.filter(pred);',
      '  const zs = ys.map(fn);',
      '  return zs.reduce(add, 0);',
      '}',
    ].join('\n');

    const fileA = writeTmp('reporter/a.js', src);
    const fileB = writeTmp(
      'reporter/b.js',
      src.replaceAll('workA', 'workB').replaceAll('xs', 'items').replaceAll('ys', 'filtered').replaceAll('zs', 'mapped'),
    );

    const { pairs } = runPipeline([fileA, fileB], { threshold: 0.5, minLines: 4, minNodes: 5 });
    expect(formatText(pairs)).toContain('DUPLICATE');
  });

  it('formatJson returns parseable JSON', () => {
    const fileA = writeTmp('reporter-json/a.js', [
      'function taskOne(items) {',
      "  return items.filter(Boolean).map(String).join(', ');",
      '}',
    ].join('\n'));

    const fileB = writeTmp('reporter-json/b.js', [
      'function taskTwo(rows) {',
      "  return rows.filter(Boolean).map(String).join(', ');",
      '}',
    ].join('\n'));

    const { pairs } = runPipeline([fileA, fileB], { threshold: 0.5, minLines: 3, minNodes: 5 });
    const json = JSON.parse(formatJson(pairs));
    expect(Array.isArray(json.candidates)).toBe(true);
  });
});

describe('full pipeline scanFiles integration', () => {
  it('scanFiles plus pipeline works end to end on a directory', async () => {
    const dir = path.join(tmpDir, 'scan-dir');

    writeTmp('scan-dir/one.js', [
      'function calcSum(numbers) {',
      '  const result = numbers.reduce((acc, n) => acc + n, 0);',
      '  return result;',
      '}',
    ].join('\n'));

    writeTmp('scan-dir/two.js', [
      'function calcTotal(values) {',
      '  const result = values.reduce((acc, v) => acc + v, 0);',
      '  return result;',
      '}',
    ].join('\n'));

    const files = await scanFiles([dir]);
    expect(files.length).toBe(2);

    const { pairs } = runPipeline(files, { threshold: 0.7, minLines: 3, minNodes: 5 });
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0].score).toBeGreaterThanOrEqual(0.7);
  });
});

describe('runCli', () => {
  it('exports documented default values', () => {
    expect(DEFAULT_THRESHOLD).toBe(0.82);
    expect(DEFAULT_MIN_LINES).toBe(4);
    expect(DEFAULT_MIN_NODES).toBe(20);
  });

  it('uses text output by default', async () => {
    const dir = path.join(tmpDir, 'cli-direct-text');

    writeTmp('cli-direct-text/a.js', [
      'function alpha(items) {',
      '  const filtered = items.filter(Boolean);',
      '  return filtered.map(String);',
      '}',
    ].join('\n'));

    writeTmp('cli-direct-text/b.js', [
      'function beta(rows) {',
      '  const kept = rows.filter(Boolean);',
      '  return kept.map(String);',
      '}',
    ].join('\n'));

    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli(['node', 'dryjs', dir], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.format).toBe('text');
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][1]).toBe('text');
    expect(spinner.successes[0]).toContain('duplicate pair(s) found');
  });

  it('honours json shorthand and numeric filters', async () => {
    const dir = path.join(tmpDir, 'cli-direct-json');
    writeTmp('cli-direct-json/short.js', [
      'function tiny(x) {',
      '  return x;',
      '}',
    ].join('\n'));

    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli(['node', 'dryjs', '--json', '--min-lines', '20', '--min-nodes', '50', dir], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.format).toBe('json');
    expect(result.entries).toEqual([]);
    expect(result.pairs).toEqual([]);
    expect(reporter).toHaveBeenCalledWith([], 'json');
  });

  it('accepts a similarity metric option', async () => {
    const dir = path.join(tmpDir, 'cli-similarity-metric');
    writeTmp('cli-similarity-metric/a.js', [
      'function a(xs) {',
      '  return xs.filter(Boolean);',
      '}',
    ].join('\n'));
    writeTmp('cli-similarity-metric/b.js', [
      'function b(rows) {',
      '  return rows.filter(Boolean);',
      '}',
    ].join('\n'));

    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli(['node', 'dryjs', '--similarity-metric', 'dice', '--json', dir], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.format).toBe('json');
    expect(reporter).toHaveBeenCalledWith(expect.any(Array), 'json');
    expect(result.pairs.length).toBeGreaterThanOrEqual(0);
  });

  it('accepts max-candidates and fast filter options', async () => {
    const dir = path.join(tmpDir, 'cli-fast-filter');
    writeTmp('cli-fast-filter/a.js', [
      'function a(xs) {',
      '  return xs.filter(Boolean).map(String);',
      '}',
    ].join('\n'));
    writeTmp('cli-fast-filter/b.js', [
      'function b(rows) {',
      '  return rows.filter(Boolean).map(String);',
      '}',
    ].join('\n'));

    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli([
      'node',
      'dryjs',
      '--max-candidates',
      '1',
      '--fast-filter-threshold',
      '0.2',
      '--json',
      dir,
    ], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.format).toBe('json');
    expect(reporter).toHaveBeenCalledWith(expect.any(Array), 'json');
    expect(result.pairs.length).toBeGreaterThanOrEqual(0);
  });

  it('warns cleanly when no source files are found', async () => {
    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli(['node', 'dryjs', path.join(tmpDir, 'missing-directory')], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.files).toEqual([]);
    expect(result.entries).toEqual([]);
    expect(result.pairs).toEqual([]);
    expect(spinner.warnings).toEqual(['No source files found.']);
    expect(reporter).not.toHaveBeenCalled();
  });

  it('respects max-files and stops scanning after the limit', async () => {
    const dir = path.join(tmpDir, 'cli-max-files');
    writeTmp('cli-max-files/a.js', 'function a() { return 1; }');
    writeTmp('cli-max-files/b.js', 'function b() { return 2; }');

    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli(['node', 'dryjs', '--max-files', '1', dir], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.files.length).toBe(1);
  });

  it('respects max-forms and limits candidate collection', async () => {
    const dir = path.join(tmpDir, 'cli-max-forms');
    writeTmp('cli-max-forms/a.js', [
      'function one(x) {',
      '  return x + 1;',
      '}',
      'function two(x) {',
      '  return x * 2;',
      '}',
    ].join('\n'));
    writeTmp('cli-max-forms/b.js', [
      'function three(y) {',
      '  return y - 1;',
      '}',
    ].join('\n'));

    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli(['node', 'dryjs', '--max-forms', '1', dir], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.entries.length).toBeLessThanOrEqual(1);
  });

  it('supports ignore file patterns with --ignore-file', async () => {
    const dir = path.join(tmpDir, 'cli-ignore-file');
    writeTmp('cli-ignore-file/a.js', 'function keepA() { return 1; }');
    writeTmp('cli-ignore-file/ignore.js', 'function skipB() { return 2; }');

    const ignoreFile = path.join(tmpDir, 'cli-ignore-file.dry4jsignore');
    fs.writeFileSync(ignoreFile, 'cli-ignore-file/ignore.js\n', 'utf8');

    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli(['node', 'dryjs', '--ignore-file', ignoreFile, dir], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.files.every((file) => !file.endsWith('ignore.js'))).toBe(true);
  });

  it('exits with code 1 for duplicates when --fail-on-duplicates is used', async () => {
    const dir = path.join(tmpDir, 'cli-fail-on-duplicates');
    writeTmp('cli-fail-on-duplicates/a.js', [
      'function alpha(xs) {',
      '  return xs.map(String);',
      '}',
    ].join('\n'));
    writeTmp('cli-fail-on-duplicates/b.js', [
      'function beta(rows) {',
      '  return rows.map(String);',
      '}',
    ].join('\n'));

    const spinner = createSpinner();
    const reporter = vi.fn();
    const result = await runCli(['node', 'dryjs', '--fail-on-duplicates', '--json', '--min-lines', '1', '--min-nodes', '1', dir], {
      reporter,
      spinnerFactory: () => spinner,
    });

    expect(result.exitCode).toBe(1);
    expect(result.pairs.length).toBeGreaterThan(0);
  });

  it('runs the packaged CLI binary via src/bin.mjs with JSON output', () => {
    const dir = path.join(tmpDir, 'cli-packaged');
    writeTmp('cli-packaged/a.js', [
      'function delta(xs) {',
      '  return xs.filter(Boolean);',
      '}',
    ].join('\n'));
    writeTmp('cli-packaged/b.js', [
      'function epsilon(rows) {',
      '  return rows.filter(Boolean);',
      '}',
    ].join('\n'));

    const binary = path.resolve('src/bin.mjs');
    const result = spawnSync(process.execPath, [binary, '--json', dir], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('candidates');
    const parsed = JSON.parse(result.stdout);
    expect(Array.isArray(parsed.candidates)).toBe(true);
  });
}
);