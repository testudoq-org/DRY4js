import { describe, it, expect, vi, afterEach } from 'vitest';
import { jaccardSimilarity, findDuplicates } from '../src/comparator.mjs';
import { formatText, formatJson, report } from '../src/reporter.mjs';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// jaccardSimilarity
// ---------------------------------------------------------------------------

describe('jaccardSimilarity', () => {
  it('identical sets have similarity 1.0', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['x', 'y', 'z']);
    expect(jaccardSimilarity(a, b)).toBe(1.0);
  });

  it('disjoint sets have similarity 0.0', () => {
    const a = new Set(['a', 'b']);
    const b = new Set(['c', 'd']);
    expect(jaccardSimilarity(a, b)).toBe(0.0);
  });

  it('partially overlapping sets are between 0 and 1', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['b', 'c', 'd']);
    const score = jaccardSimilarity(a, b);
    // intersection={b,c}=2, union={a,b,c,d}=4 → 0.5
    expect(score).toBeCloseTo(0.5);
  });

  it('two empty sets return 0.0 (not NaN)', () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
  });

  it('one empty set returns 0.0', () => {
    expect(jaccardSimilarity(new Set(['a']), new Set())).toBe(0);
  });

  it('computes correctly for known values', () => {
    // |A|=3, |B|=3, |A∩B|=2 → union=4 → score=0.5
    const a = new Set(['p', 'q', 'r']);
    const b = new Set(['q', 'r', 's']);
    expect(jaccardSimilarity(a, b)).toBeCloseTo(2 / 4);
  });
});

// ---------------------------------------------------------------------------
// findDuplicates
// ---------------------------------------------------------------------------

function makeEntry(file, startLine, endLine, fps) {
  return { file, startLine, endLine, lineCount: endLine - startLine + 1, nodeCount: 30, fingerprints: new Set(fps) };
}

describe('findDuplicates', () => {
  it('returns empty array when no entries', () => {
    expect(findDuplicates([])).toEqual([]);
  });

  it('returns empty array for a single entry', () => {
    const entries = [makeEntry('a.js', 1, 10, ['x', 'y'])];
    expect(findDuplicates(entries)).toEqual([]);
  });

  it('finds a pair that exceeds the threshold', () => {
    const fps = Array.from({ length: 20 }, (_, i) => `fp${i}`);
    const a = makeEntry('a.js', 1, 10, fps);
    const b = makeEntry('b.js', 1, 10, fps);
    const results = findDuplicates([a, b], { threshold: 0.82 });
    expect(results.length).toBe(1);
    expect(results[0].score).toBe(1.0);
  });

  it('does not flag pairs below the threshold', () => {
    // Only 1 shared fingerprint out of many → low Jaccard
    const a = makeEntry('a.js', 1, 10, ['shared', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9']);
    const b = makeEntry('b.js', 1, 10, ['shared', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9']);
    const results = findDuplicates([a, b], { threshold: 0.82 });
    expect(results.length).toBe(0);
  });

  it('skips pairs at the same file + startLine', () => {
    const fps = Array.from({ length: 20 }, (_, i) => `fp${i}`);
    const a = makeEntry('same.js', 1, 10, fps);
    const b = makeEntry('same.js', 1, 10, fps);
    const results = findDuplicates([a, b], { threshold: 0.5 });
    expect(results.length).toBe(0);
  });

  it('results are sorted by descending score', () => {
    const allFps = Array.from({ length: 30 }, (_, i) => `fp${i}`);
    const a = makeEntry('a.js', 1, 10, allFps.slice(0, 20));
    const b = makeEntry('b.js', 1, 10, allFps.slice(0, 20));   // identical to a
    const c = makeEntry('c.js', 1, 10, allFps.slice(0, 25));
    const d = makeEntry('d.js', 1, 10, allFps.slice(5, 30));   // partial overlap

    const results = findDuplicates([a, b, c, d], { threshold: 0.5 });
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('uses default threshold of 0.82 when not specified', () => {
    const fps = Array.from({ length: 20 }, (_, i) => `fp${i}`);
    const a = makeEntry('a.js', 1, 10, fps);
    const b = makeEntry('b.js', 1, 10, fps);
    const results = findDuplicates([a, b]);
    expect(results.length).toBe(1);
  });

  it('each result has score, left, and right properties', () => {
    const fps = Array.from({ length: 20 }, (_, i) => `fp${i}`);
    const a = makeEntry('a.js', 1, 10, fps);
    const b = makeEntry('b.js', 1, 10, fps);
    const [result] = findDuplicates([a, b]);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('left');
    expect(result).toHaveProperty('right');
    expect(result.left.file).toBe('a.js');
    expect(result.right.file).toBe('b.js');
  });
});

// ---------------------------------------------------------------------------
// Reporter – formatText
// ---------------------------------------------------------------------------

describe('formatText', () => {
  it('returns "No duplicate candidates found." for empty array', () => {
    expect(formatText([])).toBe('No duplicate candidates found.');
  });

  it('includes DUPLICATE keyword', () => {
    const pair = {
      score: 0.95,
      left: { file: 'src/a.js', startLine: 1, endLine: 5 },
      right: { file: 'src/b.js', startLine: 10, endLine: 14 },
    };
    const text = formatText([pair]);
    expect(text).toContain('DUPLICATE');
    expect(text).toContain('score=0.95');
    expect(text).toContain('src/a.js:1-5');
    expect(text).toContain('src/b.js:10-14');
  });

  it('separates multiple pairs with blank lines', () => {
    const pair = {
      score: 0.9,
      left: { file: 'a.js', startLine: 1, endLine: 5 },
      right: { file: 'b.js', startLine: 1, endLine: 5 },
    };
    const text = formatText([pair, pair]);
    expect(text.split('\n\n').length).toBe(2);
  });

  it('rounds score to 2 decimal places', () => {
    const pair = {
      score: 0.888888,
      left: { file: 'a.js', startLine: 1, endLine: 5 },
      right: { file: 'b.js', startLine: 1, endLine: 5 },
    };
    const text = formatText([pair]);
    expect(text).toContain('score=0.89');
  });
});

// ---------------------------------------------------------------------------
// Reporter – formatJson
// ---------------------------------------------------------------------------

describe('formatJson', () => {
  it('returns valid JSON', () => {
    expect(() => JSON.parse(formatJson([]))).not.toThrow();
  });

  it('has a candidates array at top level', () => {
    const json = JSON.parse(formatJson([]));
    expect(json).toHaveProperty('candidates');
    expect(Array.isArray(json.candidates)).toBe(true);
  });

  it('each candidate has score, left, right, leftNodes, rightNodes', () => {
    const pair = {
      score: 0.9,
      left: { file: 'a.js', startLine: 1, endLine: 5, nodeCount: 25 },
      right: { file: 'b.js', startLine: 10, endLine: 15, nodeCount: 27 },
    };
    const json = JSON.parse(formatJson([pair]));
    const [c] = json.candidates;
    expect(c).toHaveProperty('score', 0.9);
    expect(c.left.file).toBe('a.js');
    expect(c.right.file).toBe('b.js');
    expect(c).toHaveProperty('leftNodes', 25);
    expect(c).toHaveProperty('rightNodes', 27);
  });
});

// ---------------------------------------------------------------------------
// Reporter – report
// ---------------------------------------------------------------------------

describe('report', () => {
  it('logs text output by default', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    report([]);
    expect(spy).toHaveBeenCalledWith('No duplicate candidates found.');
  });

  it('logs JSON output when requested', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    report([], 'json');
    expect(() => JSON.parse(spy.mock.calls[0][0])).not.toThrow();
  });
});
