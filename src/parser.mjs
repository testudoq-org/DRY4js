/**
 * parser.mjs
 * Babel parsing + top-level form extraction.
 * Each "form" is a top-level AST node with file, line, and source metadata.
 */

import { parse } from '@babel/parser';
import fs from 'node:fs';

/** Babel parser plugins to enable broad language support */
const BABEL_PLUGINS = [
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
];

/**
 * Parse a single source file and return an array of form entries.
 * On error, logs a warning and returns an empty array (never throws).
 *
 * @param {string} filePath - Absolute path to the source file
 * @returns {FormEntry[]}
 */
export function parseFile(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    globalThis.console.warn(`[dryjs] Warning: cannot read ${filePath}: ${err.message}`);
    return [];
  }

  let ast;
  try {
    ast = parse(source, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: BABEL_PLUGINS,
    });
  } catch (err) {
    globalThis.console.warn(`[dryjs] Warning: cannot parse ${filePath}: ${err.message}`);
    return [];
  }

  const lines = source.split('\n');
  const forms = [];

  for (const node of ast.program.body) {
    const startLine = node.loc?.start?.line ?? 1;
    const endLine = node.loc?.end?.line ?? startLine;
    const lineCount = endLine - startLine + 1;

    forms.push({
      file: filePath,
      startLine,
      endLine,
      lineCount,
      node,
      source: lines.slice(startLine - 1, endLine).join('\n'),
    });
  }

  return forms;
}

/**
 * @typedef {Object} FormEntry
 * @property {string} file - Absolute path of the source file
 * @property {number} startLine - 1-based start line
 * @property {number} endLine - 1-based end line (inclusive)
 * @property {number} lineCount - Number of source lines
 * @property {import('@babel/types').Node} node - The Babel AST node
 * @property {string} source - Raw source text for this form
 */
