/**
 * scanner.mjs
 * File discovery – finds all JS/MJS/JSX/TS/TSX source files under given paths.
 */

import { glob } from 'glob';
import { minimatch } from 'minimatch';
import path from 'path';
import fs from 'fs';

/** Default extensions to scan */
export const SOURCE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'];
export const DEFAULT_IGNORE_FILE = '.dry4jsignore';

function loadIgnorePatterns(ignoreFile = DEFAULT_IGNORE_FILE) {
  const ignorePath = path.resolve(process.cwd(), ignoreFile);
  if (!fs.existsSync(ignorePath)) return { patterns: [], baseDir: process.cwd() };

  const contents = fs.readFileSync(ignorePath, 'utf8');
  const patterns = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  return { patterns, baseDir: path.dirname(ignorePath) };
}

function normalizePattern(pattern, baseDir) {
  return path.isAbsolute(pattern) ? pattern : path.resolve(baseDir, pattern);
}

function shouldIgnore(filePath, patterns, baseDir) {
  if (!patterns || patterns.length === 0) return false;

  const relativeToCwd = path.relative(process.cwd(), filePath).split(path.sep).join('/');
  const relativeToBase = path.relative(baseDir, filePath).split(path.sep).join('/');
  const absolutePath = filePath.split(path.sep).join('/');

  return patterns.some((pattern) => {
    const normalized = pattern.split(path.sep).join('/');
    return (
      minimatch(relativeToCwd, normalized, { dot: true }) ||
      minimatch(relativeToBase, normalized, { dot: true }) ||
      minimatch(absolutePath, normalized, { dot: true })
    );
  });
}

async function scanDirectory(abs, ignorePatterns, allIgnorePatterns, baseDir, results) {
  const pattern = '**/*.{js,mjs,cjs,jsx,ts,tsx}';
  const matches = await glob(pattern, {
    cwd: abs,
    absolute: true,
    nodir: true,
    ignore: allIgnorePatterns,
  });

  for (const m of matches) {
    if (!SOURCE_EXTENSIONS.includes(path.extname(m))) continue;
    if (!shouldIgnore(m, ignorePatterns, baseDir)) {
      results.add(path.normalize(m));
    }
  }
}

function addFileIfAllowed(abs, ignorePatterns, baseDir, results) {
  if (SOURCE_EXTENSIONS.includes(path.extname(abs)) && !shouldIgnore(abs, ignorePatterns, baseDir)) {
    results.add(abs);
  }
}

/**
 * Resolve a list of paths to an array of absolute source file paths.
 * Directories are searched recursively. Individual files are included as-is
 * if they match a source extension.
 *
 * @param {string[]} paths - File or directory paths to scan
 * @param {object} options
 * @param {string[]} [options.exclude=[]] - Glob patterns to exclude
 * @param {string} [options.ignoreFile] - Path to an ignore file
 * @returns {Promise<string[]>} Sorted list of absolute file paths
 */
export async function scanFiles(paths, { exclude = [], ignoreFile = DEFAULT_IGNORE_FILE } = {}) {
  const results = new Set();
  const { patterns: ignorePatterns, baseDir } = loadIgnorePatterns(ignoreFile);
  const fileIgnorePatterns = ignorePatterns.map((pattern) => normalizePattern(pattern, baseDir));
  const allIgnorePatterns = [...exclude, ...fileIgnorePatterns];

  for (const p of paths) {
    const abs = path.resolve(p);
    const stat = fs.statSync(abs, { throwIfNoEntry: false });
    if (!stat) continue;

    if (stat.isDirectory()) {
      await scanDirectory(abs, ignorePatterns, allIgnorePatterns, baseDir, results);
    } else if (stat.isFile()) {
      addFileIfAllowed(abs, ignorePatterns, baseDir, results);
    }
  }

  return [...results].sort();
}
