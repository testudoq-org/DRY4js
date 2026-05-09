/**
 * scanner.mjs
 * File discovery – finds all JS/MJS/JSX/TS/TSX source files under given paths.
 */

import { glob } from 'glob';
import path from 'path';
import fs from 'fs';

/** Default extensions to scan */
export const SOURCE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'];

/**
 * Resolve a list of paths to an array of absolute source file paths.
 * Directories are searched recursively. Individual files are included as-is
 * if they match a source extension.
 *
 * @param {string[]} paths - File or directory paths to scan
 * @returns {Promise<string[]>} Sorted list of absolute file paths
 */
export async function scanFiles(paths) {
  const results = new Set();

  for (const p of paths) {
    const abs = path.resolve(p);
    const stat = fs.statSync(abs, { throwIfNoEntry: false });

    if (!stat) continue;

    if (stat.isDirectory()) {
      const pattern = '**/*.{js,mjs,cjs,jsx,ts,tsx}';
      const matches = await glob(pattern, { cwd: abs, absolute: true, nodir: true });
      for (const m of matches) results.add(path.normalize(m));
    } else if (stat.isFile() && SOURCE_EXTENSIONS.includes(path.extname(abs))) {
      results.add(abs);
    }
  }

  return [...results].sort();
}
