/**
 * cli.test.mjs
 * Integration tests for the full dryjs pipeline.
 * Tests are done by exercising each module in the same order the CLI does,
 * without spawning a child process (faster + more reliable in CI).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { scanFiles } from '../src/scanner.mjs';
import { parseFile } from '../src/parser.mjs';
import { normalise } from '../src/normaliser.mjs';
import { fingerprint, countNodes } from '../src/fingerprinter.mjs';
import { findDuplicates } from '../src/comparator.mjs';
import { formatText, formatJson } from '../src/reporter.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir;

function writeTmp(relPath, content) {
  const full = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dryjs-cli-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Run the full pipeline on a set of already-written files.
 * @param {string[]} filePaths - Absolute paths to scan
 * @param {object} [opts]
 * @returns {{ entries: object[], pairs: object[] }}
 */
async function runPipeline(filePaths, { threshold = 0.82, minLines = 4, minNodes = 20 } = {}) {
  const entries = [];

  for (const file of filePaths) {
    const forms = parseFile(file);
    for (const form of forms) {
      if (form.lineCount < minLines) continue;
      const normNode = normalise(form.node);
      const nc = countNodes(normNode);
      if (nc < minNodes) continue;
      entries.push({
        file: form.file,
        startLine: form.startLine,
        endLine: form.endLine,
        lineCount: form.lineCount,
        nodeCount: nc,
        fingerprints: fingerprint(normNode),
      });
    }
  }

  const pairs = findDuplicates(entries, { threshold });
  return { entries, pairs };
}

// ---------------------------------------------------------------------------
// Full pipeline – identical structure, different names
// ---------------------------------------------------------------------------

describe('full pipeline – identical structure detection', () => {
  it('finds a score of 1.0 for renamed-but-identical functions', async () => {
    const fileA = writeTmp('pipeline/alpha.js', `
function processAlpha(items) {
  const filtered = items.filter(isValid);
  const sorted = filtered.sort(byDate);
  const mapped = sorted.map(transform);
  return { count: mapped.length, data: mapped };
}
`);
    const fileB = writeTmp('pipeline/beta.js', `
function processBeta(rows) {
  const filtered = rows.filter(isValid);
  const sorted = filtered.sort(byDate);
  const mapped = sorted.map(transform);
  return { count: mapped.length, data: mapped };
}
`);

    const { pairs } = await runPipeline([fileA, fileB], { threshold: 0.9, minLines: 4, minNodes: 10 });
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0].score).toBeCloseTo(1.0);
  });

  it('reports correct file and line metadata in pairs', async () => {
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

    const { pairs } = await runPipeline([fileA, fileB], { threshold: 0.5, minLines: 3, minNodes: 5 });
    expect(pairs.length).toBeGreaterThan(0);

    const pair = pairs[0];
    expect(pair.left.file).toBeTruthy();
    expect(pair.right.file).toBeTruthy();
    expect(pair.left.startLine).toBeGreaterThanOrEqual(1);
    expect(pair.right.startLine).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline – dissimilar code is not flagged
// ---------------------------------------------------------------------------

describe('full pipeline – dissimilar code not flagged', () => {
  it('does not flag structurally different functions', async () => {
    const fileA = writeTmp('dissimilar/a.js', `
function simple(x) {
  return x * 2;
}
`);
    const fileB = writeTmp('dissimilar/b.js', `
function complex(a, b, c, d) {
  const temp = a + b;
  if (temp > c) {
    return temp * d + a - b;
  }
  return d * (a + b + c);
}
`);

    const { pairs } = await runPipeline([fileA, fileB], { threshold: 0.82, minLines: 3, minNodes: 5 });
    // The two functions have completely different structure → should not match
    expect(pairs.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline – minLines / minNodes filters
// ---------------------------------------------------------------------------

describe('full pipeline – filters', () => {
  it('excludes forms below minLines', async () => {
    // A one-liner won't pass minLines=4
    const file = writeTmp('filters/tiny.js', 'const x = () => 42;\n');
    const { entries } = await runPipeline([file], { minLines: 4, minNodes: 1 });
    expect(entries.length).toBe(0);
  });

  it('excludes forms below minNodes after normalisation', async () => {
    const file = writeTmp('filters/small.js', [
      'function tiny(x) {',
      '  return x;',
      '}',
      '',
    ].join('\n'));
    const { entries } = await runPipeline([file], { minLines: 1, minNodes: 100 });
    expect(entries.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline – reporter integration
// ---------------------------------------------------------------------------

describe('full pipeline – reporter integration', () => {
  it('formatText output contains DUPLICATE for matched pairs', async () => {
    const src = `
function workA(xs) {
  const ys = xs.filter(pred);
  const zs = ys.map(fn);
  return zs.reduce(add, 0);
}
`;
    const fileA = writeTmp('reporter/a.js', src);
    const fileB = writeTmp('reporter/b.js', src.replace('workA', 'workB').replace('xs', 'items').replace('ys', 'filtered').replace('zs', 'mapped'));

    const { pairs } = await runPipeline([fileA, fileB], { threshold: 0.5, minLines: 4, minNodes: 5 });

    if (pairs.length > 0) {
      const text = formatText(pairs);
      expect(text).toContain('DUPLICATE');
    }
  });

  it('formatJson returns parseable JSON with candidates array', async () => {
    const fileA = writeTmp('reporter-json/a.js', `
function taskOne(items) {
  return items.filter(Boolean).map(String).join(', ');
}
`);
    const fileB = writeTmp('reporter-json/b.js', `
function taskTwo(rows) {
  return rows.filter(Boolean).map(String).join(', ');
}
`);

    const { pairs } = await runPipeline([fileA, fileB], { threshold: 0.5, minLines: 3, minNodes: 5 });
    const json = JSON.parse(formatJson(pairs));
    expect(json).toHaveProperty('candidates');
    expect(Array.isArray(json.candidates)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Full pipeline – multi-file scan via scanFiles
// ---------------------------------------------------------------------------

describe('full pipeline – scanFiles integration', () => {
  it('scanFiles + pipeline works end-to-end on a directory', async () => {
    const dir = path.join(tmpDir, 'scan-dir');
    writeTmp('scan-dir/one.js', `
function calcSum(numbers) {
  const result = numbers.reduce((acc, n) => acc + n, 0);
  return result;
}
`);
    writeTmp('scan-dir/two.js', `
function calcTotal(values) {
  const result = values.reduce((acc, v) => acc + v, 0);
  return result;
}
`);

    const files = await scanFiles([dir]);
    expect(files.length).toBe(2);

    const { pairs } = await runPipeline(files, { threshold: 0.7, minLines: 3, minNodes: 5 });
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0].score).toBeGreaterThanOrEqual(0.7);
  });
});
