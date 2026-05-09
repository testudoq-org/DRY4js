/**
 * comparator.mjs
 * Computes Jaccard similarity between two fingerprint sets and finds duplicate
 * candidate pairs that exceed a similarity threshold.
 */

/**
 * Jaccard similarity: |A ∩ B| / |A ∪ B|
 *
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number} Value in [0, 1]
 */
export function jaccardSimilarity(a, b) {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const fp of a) {
    if (b.has(fp)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Find all pairs of entries whose normalised fingerprint sets are similar
 * enough to be flagged as duplicate candidates.
 *
 * @param {CandidateEntry[]} entries
 * @param {object} options
 * @param {number} [options.threshold=0.82] - Minimum Jaccard score
 * @returns {DuplicatePair[]}
 */
export function findDuplicates(entries, { threshold = 0.82 } = {}) {
  const results = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const left = entries[i];
      const right = entries[j];

      // Skip pairs at the exact same location
      if (left.file === right.file && left.startLine === right.startLine) continue;

      const score = jaccardSimilarity(left.fingerprints, right.fingerprints);
      if (score >= threshold) {
        results.push({ score, left, right });
      }
    }
  }

  // Sort: highest score first, then by file + line for stability
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.left.file !== b.left.file) return a.left.file.localeCompare(b.left.file);
    return a.left.startLine - b.left.startLine;
  });

  return results;
}

/**
 * @typedef {Object} CandidateEntry
 * @property {string} file
 * @property {number} startLine
 * @property {number} endLine
 * @property {number} nodeCount
 * @property {Set<string>} fingerprints
 */

/**
 * @typedef {Object} DuplicatePair
 * @property {number} score
 * @property {CandidateEntry} left
 * @property {CandidateEntry} right
 */
