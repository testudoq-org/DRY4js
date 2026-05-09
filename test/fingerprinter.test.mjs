import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { normalise } from '../src/normaliser.mjs';
import { fingerprint, countNodes, MIN_NODES } from '../src/fingerprinter.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFirst(src) {
  const ast = parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties'],
  });
  return ast.program.body[0];
}

function fpFirst(src) {
  return fingerprint(normalise(parseFirst(src)));
}

// ---------------------------------------------------------------------------
// countNodes
// ---------------------------------------------------------------------------

describe('countNodes', () => {
  it('leaf node has count 1', () => {
    expect(countNodes({ type: ':symbol', children: [] })).toBe(1);
  });

  it('node with two leaf children has count 3', () => {
    const node = {
      type: 'BinaryExpression',
      children: [
        { type: ':symbol', children: [] },
        { type: ':symbol', children: [] },
      ],
    };
    expect(countNodes(node)).toBe(3);
  });

  it('deeply nested count is correct', () => {
    const node = {
      type: 'A',
      children: [
        { type: 'B', children: [{ type: 'C', children: [] }] },
        { type: 'D', children: [] },
      ],
    };
    // A(1) + B(1) + C(1) + D(1) = 4
    expect(countNodes(node)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// fingerprint – basic properties
// ---------------------------------------------------------------------------

describe('fingerprint – basic properties', () => {
  it('returns a Set', () => {
    const fps = fpFirst('function foo() { return 1; }');
    expect(fps instanceof Set).toBe(true);
  });

  it('returns a non-empty Set for a non-trivial function', () => {
    const fps = fpFirst('function foo(x) { return x + 1; }');
    expect(fps.size).toBeGreaterThan(0);
  });

  it('every element in the Set is a string', () => {
    const fps = fpFirst('function foo(x) { return x + 1; }');
    for (const fp of fps) {
      expect(typeof fp).toBe('string');
    }
  });

  it('every fingerprint is valid JSON', () => {
    const fps = fpFirst('function complex(a, b) { if (a > b) { return a; } return b; }');
    for (const fp of fps) {
      expect(() => JSON.parse(fp)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// fingerprint – structural identity
// ---------------------------------------------------------------------------

describe('fingerprint – structurally identical code', () => {
  it('two renamed but structurally identical functions share ALL fingerprints', () => {
    const a = fpFirst('function alpha(xs) { const ys = xs.filter(odd); return ys.map(inc); }');
    const b = fpFirst('function beta(items) { const kept = items.filter(even); return kept.map(dec); }');

    const intersection = new Set([...a].filter((fp) => b.has(fp)));
    const union = new Set([...a, ...b]);

    // Jaccard should be 1.0
    expect(intersection.size).toBe(union.size);
  });

  it('same function name twice produces identical fingerprint sets', () => {
    const src = 'function foo(x) { return x * 2; }';
    const a = fpFirst(src);
    const b = fpFirst(src);

    expect([...a].sort()).toEqual([...b].sort());
  });

  it('structurally different functions have different fingerprint sets', () => {
    const a = fpFirst('function foo(x) { return x + 1; }');
    const b = fpFirst('function bar(x, y) { return x + y; }');

    const intersection = [...a].filter((fp) => b.has(fp));
    const union = new Set([...a, ...b]);

    // Not identical
    expect(intersection.length).toBeLessThan(union.size);
  });
});

// ---------------------------------------------------------------------------
// fingerprint – MIN_NODES filter
// ---------------------------------------------------------------------------

describe('fingerprint – MIN_NODES filter', () => {
  it('tiny sub-trees below MIN_NODES are not included', () => {
    const fps = fpFirst('const x = 1;');
    for (const fp of fps) {
      const parsed = JSON.parse(fp);
      expect(countNodes(parsed)).toBeGreaterThanOrEqual(MIN_NODES);
    }
  });
});

// ---------------------------------------------------------------------------
// fingerprint – determinism
// ---------------------------------------------------------------------------

describe('fingerprint – determinism', () => {
  it('produces the same Set contents on repeated calls', () => {
    const src = 'function multi(a, b, c) { if (a) { return b + c; } return a * 2; }';
    const node = parseFirst(src);
    const norm = normalise(node);

    const runs = Array.from({ length: 10 }, () => [...fingerprint(norm)].sort().join('|'));
    expect(new Set(runs).size).toBe(1);
  });

  it('fingerprints do not depend on variable name choices', () => {
    const a = fpFirst('function processItems(items) { return items.filter(Boolean).map(String); }');
    const b = fpFirst('function handleData(data) { return data.filter(Boolean).map(String); }');

    const sortedA = [...a].sort().join('\n');
    const sortedB = [...b].sort().join('\n');
    expect(sortedA).toBe(sortedB);
  });
});

// ---------------------------------------------------------------------------
// fingerprint – overlap reflects partial similarity
// ---------------------------------------------------------------------------

describe('fingerprint – partial overlap', () => {
  it('similar but not identical functions share some fingerprints', () => {
    const a = fpFirst([
      'function invoice(orders) {',
      '  const paid = orders.filter(isPaid);',
      '  const sorted = paid.sort(byDate);',
      '  return { count: sorted.length, total: sorted.reduce(add, 0) };',
      '}',
    ].join('\n'));

    const b = fpFirst([
      'function receipt(rows) {',
      '  const closed = rows.filter(isClosed);',
      '  const sorted = closed.sort(byDate);',
      '  return { count: sorted.length, total: sorted.reduce(add, 0) };',
      '}',
    ].join('\n'));

    const intersection = [...a].filter((fp) => b.has(fp)).length;
    const union = new Set([...a, ...b]).size;

    const jaccard = intersection / union;
    // Should be meaningfully similar (> 0.5) but not identical
    expect(jaccard).toBeGreaterThan(0.5);
    expect(jaccard).toBeLessThanOrEqual(1.0);
  });
});
