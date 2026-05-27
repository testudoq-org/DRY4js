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

export function diceSimilarity(a, b) {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const fp of a) {
    if (b.has(fp)) intersection++;
  }

  const total = a.size + b.size;
  return total === 0 ? 0 : (2 * intersection) / total;
}

export function cosineSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const fp of a) {
    if (b.has(fp)) intersection++;
  }

  return intersection / Math.sqrt(a.size * b.size);
}

export function combinedSimilarity(a, b, weight = 0.5) {
  const jaccard = jaccardSimilarity(a, b);
  const dice = diceSimilarity(a, b);
  return weight * jaccard + (1 - weight) * dice;
}

export function sizeSimilarity(left, right) {
  if (left.nodeCount === 0 || right.nodeCount === 0) return 0;
  const minCount = Math.min(left.nodeCount, right.nodeCount);
  const maxCount = Math.max(left.nodeCount, right.nodeCount);
  return maxCount === 0 ? 0 : minCount / maxCount;
}

function isSameLocation(left, right) {
  return left.file === right.file && left.startLine === right.startLine;
}

function createStageOnePair(left, right) {
  return { left, right, score: sizeSimilarity(left, right) };
}

function passesFastFilter(pair, threshold) {
  return pair.score >= threshold;
}

function limitStageOneCandidates(candidates, maxCandidates) {
  if (typeof maxCandidates !== 'number' || !Number.isFinite(maxCandidates) || maxCandidates <= 0) {
    return candidates;
  }

  if (candidates.length <= maxCandidates) return candidates;
  candidates.sort((a, b) => b.score - a.score);
  candidates.length = maxCandidates;
  return candidates;
}

export function fastFilterPairs(entries, { fastFilterThreshold = DEFAULT_FAST_FILTER_THRESHOLD, maxCandidates } = {}) {
  const candidates = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const left = entries[i];
      const right = entries[j];
      if (isSameLocation(left, right)) continue;

      const pair = createStageOnePair(left, right);
      if (!passesFastFilter(pair, fastFilterThreshold)) continue;
      candidates.push(pair);
    }
  }

  return limitStageOneCandidates(candidates, maxCandidates);
}

const SUPPORTED_METRICS = new Set(['jaccard', 'dice', 'cosine', 'combined']);
const DEFAULT_COMBINED_THRESHOLD = 0.78;
const DEFAULT_JACCARD_THRESHOLD = 0.82;
const DEFAULT_FAST_FILTER_THRESHOLD = 0.25;

function getSimilarityFunction(metric, combinedWeight) {
  switch (metric) {
    case 'dice':
      return diceSimilarity;
    case 'cosine':
      return cosineSimilarity;
    case 'combined':
      return (a, b) => combinedSimilarity(a, b, combinedWeight);
    case 'jaccard':
      return jaccardSimilarity;
    default:
      throw new Error(`Unsupported similarity metric: ${metric}`);
  }
}

function getAdaptiveThreshold(baseThreshold, left, right) {
  const averageNodes = (left.nodeCount + right.nodeCount) / 2;
  if (averageNodes < 30) return Math.min(baseThreshold + 0.10, 0.95);
  if (averageNodes < 60) return Math.min(baseThreshold + 0.05, 0.90);
  return baseThreshold;
}

/**
 * Find all pairs of entries whose normalised fingerprint sets are similar
 * enough to be flagged as duplicate candidates.
 *
 * @param {CandidateEntry[]} entries
 * @param {object} options
 * @param {number} [options.threshold] - Minimum similarity score
 * @param {string} [options.metric='jaccard'] - Similarity metric to use
 * @param {number} [options.combinedWeight=0.5] - Weight used for combined score
 * @param {boolean} [options.adaptiveThreshold=false] - Apply adaptive thresholds for smaller candidates
 * @returns {DuplicatePair[]}
 */
export function findDuplicates(entries, { threshold, metric = 'jaccard', combinedWeight = 0.5, fastFilterThreshold = DEFAULT_FAST_FILTER_THRESHOLD, adaptiveThreshold = false, maxCandidates } = {}) {
  if (!SUPPORTED_METRICS.has(metric)) {
    throw new Error(`Unsupported similarity metric: ${metric}`);
  }

  const scoreFn = getSimilarityFunction(metric, combinedWeight);
  const baseThreshold = typeof threshold === 'number'
    ? threshold
    : metric === 'combined'
      ? DEFAULT_COMBINED_THRESHOLD
      : DEFAULT_JACCARD_THRESHOLD;

  const stageOnePairs = fastFilterPairs(entries, { fastFilterThreshold, maxCandidates });
  const results = [];

  for (const { left, right } of stageOnePairs) {
    const score = scoreFn(left.fingerprints, right.fingerprints);
    const effectiveThreshold = adaptiveThreshold
      ? getAdaptiveThreshold(baseThreshold, left, right)
      : baseThreshold;

    if (score >= effectiveThreshold) {
      results.push({ score, left, right });
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
