import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
      src.replace('workA', 'workB').replace('xs', 'items').replace('ys', 'filtered').replace('zs', 'mapped'),
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
}
);