/**
 * reporter.mjs
 * Output formatting for duplicate candidates.
 * Supports "text" (human-readable) and "json" (machine-readable) formats.
 */

/**
 * Format a list of duplicate pairs as human-readable text.
 *
 * @param {import('./comparator.mjs').DuplicatePair[]} pairs
 * @returns {string}
 */
export function formatText(pairs) {
  if (pairs.length === 0) return 'No duplicate candidates found.';

  return pairs
    .map((pair) => {
      const score = pair.score.toFixed(2);
      const left = `${pair.left.file}:${pair.left.startLine}-${pair.left.endLine}`;
      const right = `${pair.right.file}:${pair.right.startLine}-${pair.right.endLine}`;
      return `DUPLICATE score=${score}\n  ${left}\n  ${right}`;
    })
    .join('\n\n');
}

/**
 * Format a list of duplicate pairs as a JSON string.
 *
 * @param {import('./comparator.mjs').DuplicatePair[]} pairs
 * @returns {string}
 */
export function formatJson(pairs) {
  const candidates = pairs.map((pair) => ({
    score: pair.score,
    left: {
      file: pair.left.file,
      startLine: pair.left.startLine,
      endLine: pair.left.endLine,
    },
    right: {
      file: pair.right.file,
      startLine: pair.right.startLine,
      endLine: pair.right.endLine,
    },
    leftNodes: pair.left.nodeCount,
    rightNodes: pair.right.nodeCount,
  }));

  return JSON.stringify({ candidates }, null, 2);
}

/**
 * Print results to stdout.
 *
 * @param {import('./comparator.mjs').DuplicatePair[]} pairs
 * @param {'text'|'json'} format
 */
export function report(pairs, format = 'text') {
  if (format === 'json') {
    globalThis.console.log(formatJson(pairs));
  } else {
    globalThis.console.log(formatText(pairs));
  }
}
