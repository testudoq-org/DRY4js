import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { normalise, serialise } from '../src/normaliser.mjs';

// ---------------------------------------------------------------------------
// Helper: parse a snippet and return the first top-level node
// ---------------------------------------------------------------------------

function parseFirst(src) {
  const ast = parse(src, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'typescript',
      'decorators-legacy',
      'classProperties',
      'classPrivateProperties',
      'classPrivateMethods',
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
      'logicalAssignment',
      'numericSeparator',
      'objectRestSpread',
    ],
  });
  return ast.program.body[0];
}

function normFirst(src) {
  return normalise(parseFirst(src));
}

// ---------------------------------------------------------------------------
// Core invariant: renamed but structurally identical → same normalised form
// ---------------------------------------------------------------------------

describe('normalise – structural identity invariant', () => {
  it('two functions with different names produce the same NormNode', () => {
    const a = normFirst('function alpha(x) { return x + 1; }');
    const b = normFirst('function beta(y) { return y + 1; }');
    expect(serialise(a)).toBe(serialise(b));
  });

  it('different parameter names produce the same NormNode', () => {
    const a = normFirst('function foo(a, b) { return a + b; }');
    const b = normFirst('function bar(x, y) { return x + y; }');
    expect(serialise(a)).toBe(serialise(b));
  });

  it('different literal values produce the same NormNode', () => {
    const a = normFirst('function foo(x) { return x + 1; }');
    const b = normFirst('function bar(y) { return y + 999; }');
    expect(serialise(a)).toBe(serialise(b));
  });

  it('different string literals produce the same NormNode', () => {
    const a = normFirst('function a() { return "hello"; }');
    const b = normFirst('function b() { return "world"; }');
    expect(serialise(a)).toBe(serialise(b));
  });

  it('arrow functions with equivalent structure are identical', () => {
    const a = normFirst('const alpha = (x) => x * 2;');
    const b = normFirst('const beta = (y) => y * 2;');
    expect(serialise(a)).toBe(serialise(b));
  });

  it('structurally different functions produce different NormNodes', () => {
    const a = normFirst('function foo(x) { return x + 1; }');
    const b = normFirst('function bar(x, y) { return x + y; }');
    expect(serialise(a)).not.toBe(serialise(b));
  });

  it('if-else vs if (no else) are different', () => {
    const a = normFirst('function f(x) { if (x) { return 1; } }');
    const b = normFirst('function g(y) { if (y) { return 1; } else { return 2; } }');
    expect(serialise(a)).not.toBe(serialise(b));
  });
});

// ---------------------------------------------------------------------------
// Identifier and literal normalisation
// ---------------------------------------------------------------------------

describe('normalise – identifiers and literals', () => {
  it('identifiers become :symbol', () => {
    const norm = normalise({ type: 'Identifier', name: 'myVar' });
    expect(norm.type).toBe(':symbol');
    expect(norm.children).toEqual([]);
  });

  it('stableSymbols mode preserves consistent numeric symbol identities', () => {
    const norm = normalise({
      type: 'BinaryExpression',
      left: { type: 'Identifier', name: 'alpha' },
      right: { type: 'Identifier', name: 'beta' },
    }, { stableSymbols: true });

    expect(norm.children[0].type).toBe(':symbol0');
    expect(norm.children[1].type).toBe(':symbol1');
  });

  it('string literals become :literal', () => {
    const norm = normalise({ type: 'StringLiteral', value: 'hello' });
    expect(norm.type).toBe(':literal');
  });

  it('numeric literals become :literal', () => {
    const norm = normalise({ type: 'NumericLiteral', value: 42 });
    expect(norm.type).toBe(':literal');
  });

  it('boolean literals become :literal', () => {
    const norm = normalise({ type: 'BooleanLiteral', value: true });
    expect(norm.type).toBe(':literal');
  });

  it('null literal becomes :literal', () => {
    const norm = normalise({ type: 'NullLiteral' });
    expect(norm.type).toBe(':literal');
  });

  it('template literals become :literal', () => {
    const norm = normFirst('const x = `hello ${name}`;');
    // VariableDeclaration > VariableDeclarator > TemplateLiteral
    const decl = norm.children[0]; // VariableDeclarator
    expect(decl.children[1].type).toBe(':literal');
  });
});

// ---------------------------------------------------------------------------
// Structure preservation
// ---------------------------------------------------------------------------

describe('normalise – structure preservation', () => {
  it('preserves FunctionDeclaration type tag', () => {
    const norm = normFirst('function foo() {}');
    expect(norm.type).toBe('FunctionDeclaration');
  });

  it('preserves BlockStatement type tag', () => {
    const norm = normFirst('function foo() { return 1; }');
    // last child is the block
    const block = norm.children[norm.children.length - 1];
    expect(block.type).toBe('BlockStatement');
  });

  it('preserves CallExpression type tag', () => {
    const norm = normFirst('foo(1, 2);');
    // ExpressionStatement > CallExpression
    expect(norm.type).toBe('ExpressionStatement');
    expect(norm.children[0].type).toBe('CallExpression');
  });

  it('preserves parameter count (arity matters)', () => {
    const one = normFirst('function f(a) {}');
    const two = normFirst('function g(a, b) {}');
    // one param vs two params → different child count → different serialisation
    expect(serialise(one)).not.toBe(serialise(two));
  });

  it('preserves VariableDeclaration type', () => {
    const norm = normFirst('const x = 1;');
    expect(norm.type).toBe('VariableDeclaration');
  });

  it('preserves ArrowFunctionExpression type', () => {
    const norm = normFirst('const f = () => 42;');
    // VariableDeclaration > VariableDeclarator > ArrowFunctionExpression
    const decl = norm.children[0];
    expect(decl.children[1].type).toBe('ArrowFunctionExpression');
  });

  it('preserves IfStatement type', () => {
    const norm = normFirst('if (x) { y(); }');
    expect(norm.type).toBe('IfStatement');
  });

  it('preserves ReturnStatement type', () => {
    const norm = normFirst('function f() { return 1; }');
    const block = norm.children[norm.children.length - 1];
    expect(block.children[0].type).toBe('ReturnStatement');
  });

  it('preserves BinaryExpression type', () => {
    const norm = normFirst('const z = a + b;');
    const decl = norm.children[0]; // VariableDeclarator
    expect(decl.children[1].type).toBe('BinaryExpression');
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('normalise – determinism', () => {
  it('produces the same output on repeated calls', () => {
    const src = 'function complexFn(a, b, c) { if (a > b) { return c * 2; } return a + b; }';
    const node = parseFirst(src);
    const results = Array.from({ length: 10 }, () => serialise(normalise(node)));
    expect(new Set(results).size).toBe(1);
  });

  it('child order is fixed (not property-enumeration order)', () => {
    const a = normFirst('function f(x, y) { return x - y; }');
    const b = normFirst('function f(x, y) { return x - y; }');
    expect(serialise(a)).toBe(serialise(b));
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('normalise – edge cases', () => {
  it('handles null gracefully', () => {
    const norm = normalise(null);
    expect(norm.type).toBe(':null');
  });

  it('handles undefined gracefully', () => {
    const norm = normalise(undefined);
    expect(norm.type).toBe(':null');
  });

  it('handles class declarations', () => {
    const norm = normFirst('class Foo extends Bar { constructor() {} }');
    expect(norm.type).toBe('ClassDeclaration');
  });

  it('handles import declarations', () => {
    const norm = normFirst("import fs from 'fs';");
    expect(norm.type).toBe('ImportDeclaration');
  });

  it('handles export default', () => {
    const norm = normFirst('export default function foo() {}');
    expect(norm.type).toBe('ExportDefaultDeclaration');
  });

  it('handles try/catch', () => {
    const norm = normFirst('try { doThing(); } catch(e) { log(e); }');
    expect(norm.type).toBe('TryStatement');
    expect(norm.children.length).toBeGreaterThanOrEqual(2);
  });

  it('handles for loops', () => {
    const norm = normFirst('for (let i = 0; i < 10; i++) { foo(i); }');
    expect(norm.type).toBe('ForStatement');
  });

  it('handles while loops', () => {
    const norm = normFirst('while (running) { tick(); }');
    expect(norm.type).toBe('WhileStatement');
  });

  it('handles array expressions', () => {
    const norm = normFirst('const arr = [1, 2, 3];');
    const decl = norm.children[0];
    expect(decl.children[1].type).toBe('ArrayExpression');
  });

  it('handles object expressions', () => {
    const norm = normFirst('const obj = { a: 1, b: 2 };');
    const decl = norm.children[0];
    expect(decl.children[1].type).toBe('ObjectExpression');
  });

  it('handles switch statements with explicit and default cases', () => {
    const norm = normFirst('switch (x) { case 1: foo(); break; default: bar(); }');
    expect(norm.type).toBe('SwitchStatement');
    expect(norm.children[1].type).toBe('SwitchCase');
    expect(norm.children[2].type).toBe('SwitchCase');
    expect(norm.children[2].children[0].type).toBe('ExpressionStatement');
  });

  it('handles do-while, for-in, and for-of loops', () => {
    expect(normFirst('do { tick(); } while (ready);').type).toBe('DoWhileStatement');
    expect(normFirst('for (const key in obj) { use(key); }').type).toBe('ForInStatement');
    expect(normFirst('for (const value of list) { use(value); }').type).toBe('ForOfStatement');
  });

  it('handles labeled statements, breaks, continues, and throws', () => {
    const labeled = normFirst('outer: while (running) { if (stop) break; continue outer; }');
    expect(labeled.type).toBe('LabeledStatement');

    const thrown = normFirst('throw new Error("boom");');
    expect(thrown.type).toBe('ThrowStatement');
  });

  it('handles destructuring, default params, and rest params', () => {
    const norm = normFirst('function f({ a }, [x], y = 1, ...rest) { return rest; }');
    expect(norm.children[0].type).toBe('ObjectPattern');
    expect(norm.children[1].type).toBe('ArrayPattern');
    expect(norm.children[2].type).toBe('AssignmentPattern');
    expect(norm.children[3].type).toBe('RestElement');
  });

  it('handles export forms without inline declarations', () => {
    const named = normFirst("export { default as foo } from './dep.js';");
    expect(named.type).toBe('ExportNamedDeclaration');
    expect(named.children).toEqual([]);

    const all = normFirst("export * from './dep.js';");
    expect(all.type).toBe('ExportAllDeclaration');
  });

  it('handles TypeScript declaration forms', () => {
    expect(normFirst('interface Foo { bar: string }').type).toBe('TSInterfaceDeclaration');
    expect(normFirst('type Foo = string;').type).toBe('TSTypeAliasDeclaration');
    expect(normFirst('enum Color { Red }').type).toBe('TSEnumDeclaration');
  });

  it('handles private class fields and private methods', () => {
    const norm = normFirst('class Foo { #value = 1; #get() { return this.#value; } }');
    const body = norm.children[norm.children.length - 1];
    expect(body.type).toBe('ClassBody');
    expect(body.children.some((child) => child.type === 'ClassPrivateProperty')).toBe(true);
    expect(body.children.some((child) => child.type === 'ClassPrivateMethod')).toBe(true);
  });

  it('handles optional chaining, tagged templates, await, yield, and sequences', () => {
    const optional = normFirst('const result = obj?.prop?.(tag`x`);');
    const optionalDecl = optional.children[0];
    expect(optionalDecl.children[1].type).toBe('OptionalCallExpression');

    const awaited = normFirst('async function f(x) { return await x; }');
    const awaitedBlock = awaited.children[awaited.children.length - 1];
    expect(awaitedBlock.children[0].children[0].type).toBe('AwaitExpression');

    const yielded = normFirst('function* g(x) { yield x; }');
    const yieldedBlock = yielded.children[yielded.children.length - 1];
    expect(yieldedBlock.children[0].children[0].type).toBe('YieldExpression');

    const sequenced = normFirst('const value = (a(), b(), c());');
    const sequenceDecl = sequenced.children[0];
    expect(sequenceDecl.children[1].type).toBe('SequenceExpression');
  });

  it('handles JSX fragments, expression containers, and spread children', () => {
    const norm = normFirst('const el = <><span>{value}</span>{...items}</>;');
    const decl = norm.children[0];
    const fragment = decl.children[1];
    expect(fragment.type).toBe('JSXFragment');
    expect(fragment.children.some((child) => child.type === 'JSXElement')).toBe(true);
    expect(fragment.children.some((child) => child.type === 'JSXSpreadChild')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// serialise
// ---------------------------------------------------------------------------

describe('serialise', () => {
  it('returns a non-empty JSON string', () => {
    const norm = normFirst('function f() {}');
    const s = serialise(norm);
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
    expect(() => JSON.parse(s)).not.toThrow();
  });

  it('two identical structures produce the same serialised string', () => {
    const a = normFirst('function f(x) { return x; }');
    const b = normFirst('function g(y) { return y; }');
    expect(serialise(a)).toBe(serialise(b));
  });
});
