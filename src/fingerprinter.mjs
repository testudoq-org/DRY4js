/**
 * fingerprinter.mjs
 * Walks a NormNode tree and collects every sub-tree serialised as a JSON string.
 * Result is a Set<string> of fingerprints.
 *
 * Small sub-trees (< MIN_NODES nodes) are excluded to reduce noise.
 */

import { serialise } from './normaliser.mjs';

/** Minimum number of nodes in a sub-tree to include as a fingerprint */
export const MIN_NODES = 3;

/**
 * Count the total number of nodes in a NormNode tree.
 *
 * @param {import('./normaliser.mjs').NormNode} node
 * @returns {number}
 */
export function countNodes(node) {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

/**
 * Produce a Set of fingerprint strings for the given NormNode.
 * Each fingerprint is the JSON serialisation of a sub-tree that has
 * at least MIN_NODES nodes.
 *
 * @param {import('./normaliser.mjs').NormNode} normNode
 * @returns {Set<string>}
 */
export function fingerprint(normNode) {
  const result = new Set();
  walk(normNode, result);
  return result;
}

/** @param {import('./normaliser.mjs').NormNode} node */
function walk(node, acc) {
  if (countNodes(node) >= MIN_NODES) {
    acc.add(serialise(node));
  }
  for (const child of node.children) {
    walk(child, acc);
  }
}
