/**
 * utils.mjs
 * Shared helpers used across dryjs modules.
 */

/**
 * Count nodes in a NormNode tree.
 * Exported here so modules that don't import fingerprinter can still count.
 *
 * @param {{ type: string, children: any[] }} node
 * @returns {number}
 */
export function countNodes(node) {
  return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}
