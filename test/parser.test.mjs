import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanFiles, SOURCE_EXTENSIONS } from '../src/scanner.mjs';
import { parseFile } from '../src/parser.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir;

function writeTmp(name, content) {
  const full = path.join(tmpDir, name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dryjs-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Scanner tests
// ---------------------------------------------------------------------------

describe('scanFiles', () => {
  it('returns an empty array for a non-existent path', async () => {
    const files = await scanFiles([path.join(tmpDir, 'no-such-dir')]);
    expect(files).toEqual([]);
  });

  it('finds .js files in a directory', async () => {
    writeTmp('scanner-test/a.js', 'const x = 1;');
    writeTmp('scanner-test/b.js', 'const y = 2;');
    const files = await scanFiles([path.join(tmpDir, 'scanner-test')]);
    expect(files.length).toBe(2);
    expect(files.every((f) => f.endsWith('.js'))).toBe(true);
  });

  it('finds .mjs and .jsx files', async () => {
    writeTmp('scanner-mjs/a.mjs', 'export const x = 1;');
    writeTmp('scanner-mjs/b.jsx', 'export default () => <div/>;');
    const files = await scanFiles([path.join(tmpDir, 'scanner-mjs')]);
    expect(files.length).toBe(2);
  });

  it('returns sorted file paths', async () => {
    writeTmp('scanner-sort/z.js', '');
    writeTmp('scanner-sort/a.js', '');
    writeTmp('scanner-sort/m.js', '');
    const files = await scanFiles([path.join(tmpDir, 'scanner-sort')]);
    expect(files).toEqual([...files].sort());
  });

  it('accepts a direct file path', async () => {
    const f = writeTmp('scanner-direct/single.js', 'const x = 1;');
    const files = await scanFiles([f]);
    expect(files).toEqual([f]);
  });

  it('ignores non-source files', async () => {
    writeTmp('scanner-ignore/data.json', '{}');
    writeTmp('scanner-ignore/notes.txt', 'hello');
    writeTmp('scanner-ignore/app.js', 'const x = 1;');
    const files = await scanFiles([path.join(tmpDir, 'scanner-ignore')]);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/app\.js$/);
  });

  it('SOURCE_EXTENSIONS contains expected extensions', () => {
    expect(SOURCE_EXTENSIONS).toContain('.js');
    expect(SOURCE_EXTENSIONS).toContain('.mjs');
    expect(SOURCE_EXTENSIONS).toContain('.jsx');
    expect(SOURCE_EXTENSIONS).toContain('.ts');
    expect(SOURCE_EXTENSIONS).toContain('.tsx');
  });
});

// ---------------------------------------------------------------------------
// Parser tests
// ---------------------------------------------------------------------------

describe('parseFile', () => {
  it('returns an empty array for a non-existent file', () => {
    const forms = parseFile(path.join(tmpDir, 'does-not-exist.js'));
    expect(forms).toEqual([]);
  });

  it('returns an empty array for an unparseable file', () => {
    const bad = writeTmp('parse-bad/bad.js', '((( this is not valid js');
    const forms = parseFile(bad);
    expect(forms).toEqual([]);
  });

  it('extracts top-level forms from a simple file', () => {
    const src = writeTmp('parse-simple/simple.js', [
      'const x = 1;',
      'function foo() { return x; }',
      'export default foo;',
    ].join('\n'));
    const forms = parseFile(src);
    expect(forms.length).toBe(3);
  });

  it('each form has file, startLine, endLine, lineCount, node', () => {
    const src = writeTmp('parse-fields/fields.js', 'function bar() {\n  return 42;\n}');
    const forms = parseFile(src);
    expect(forms.length).toBe(1);
    const [form] = forms;
    expect(form.file).toBe(src);
    expect(form.startLine).toBe(1);
    expect(form.endLine).toBe(3);
    expect(form.lineCount).toBe(3);
    expect(form.node).toBeTruthy();
    expect(form.node.type).toBe('FunctionDeclaration');
  });

  it('line numbers are 1-based', () => {
    const src = writeTmp('parse-lines/lines.js', [
      '// line 1',
      'const a = 1;',
      'const b = 2;',
    ].join('\n'));
    const forms = parseFile(src);
    expect(forms[0].startLine).toBeGreaterThanOrEqual(1);
  });

  it('handles arrow functions', () => {
    const src = writeTmp('parse-arrow/arrow.js', 'const fn = (x) => x * 2;');
    const forms = parseFile(src);
    expect(forms.length).toBe(1);
    expect(forms[0].node.type).toBe('VariableDeclaration');
  });

  it('handles ES module imports and exports', () => {
    const src = writeTmp('parse-esm/esm.mjs', [
      "import fs from 'fs';",
      'export function doThing() {}',
    ].join('\n'));
    const forms = parseFile(src);
    expect(forms.length).toBe(2);
  });

  it('handles TypeScript syntax gracefully', () => {
    const src = writeTmp('parse-ts/types.ts', [
      'interface Foo { bar: string; }',
      'function greet(name: string): string { return `Hello ${name}`; }',
    ].join('\n'));
    const forms = parseFile(src);
    expect(forms.length).toBe(2);
  });

  it('never throws on malformed input', () => {
    const src = writeTmp('parse-throw/malformed.js', '<<<not js>>>');
    expect(() => parseFile(src)).not.toThrow();
  });
});
