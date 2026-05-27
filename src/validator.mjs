import { parse } from '@babel/parser';
import { normalise } from './normaliser.mjs';
import { fingerprint, countNodes } from './fingerprinter.mjs';
import { findDuplicates } from './comparator.mjs';

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

const VALIDATION_CASES = [
  {
    name: 'Renamed identical function body',
    left: [
      'function processAlpha(items) {',
      '  const filtered = items.filter(Boolean);',
      '  const total = filtered.length;',
      '  return { total, items: filtered };',
      '}',
    ].join('\n'),
    right: [
      'function processBeta(rows) {',
      '  const kept = rows.filter(Boolean);',
      '  const total = kept.length;',
      '  return { total, items: kept };',
      '}',
    ].join('\n'),
    expectedDuplicate: true,
  },
  {
    name: 'Same structure with different names and order',
    left: [
      'const compute = (values) => {',
      '  const result = values.map((value) => value * 2);',
      '  return result.reduce((sum, item) => sum + item, 0);',
      '};',
    ].join('\n'),
    right: [
      'const summarize = (input) => {',
      '  const doubled = input.map((item) => item * 2);',
      '  return doubled.reduce((total, amount) => total + amount, 0);',
      '};',
    ].join('\n'),
    expectedDuplicate: true,
  },
  {
    name: 'Different control flow',
    left: [
      'function countAboveThreshold(items, threshold) {',
      '  let count = 0;',
      '  for (const item of items) {',
      '    if (item > threshold) count += 1;',
      '  }',
      '  return count;',
      '}',
    ].join('\n'),
    right: [
      'function filterAndSum(items, threshold) {',
      '  return items',
      '    .filter((item) => item > threshold)',
      '    .reduce((sum, item) => sum + item, 0);',
      '}',
    ].join('\n'),
    expectedDuplicate: false,
  },
  {
    name: 'Different algorithm shape',
    left: [
      'function formatUser(user) {',
      '  return `${user.firstName} ${user.lastName}`;',
      '}',
    ].join('\n'),
    right: [
      'function addNumbers(a, b) {',
      '  const result = a + b;',
      '  return result;',
      '}',
    ].join('\n'),
    expectedDuplicate: false,
  },
];

function parseSource(source, label) {
  const ast = parse(source, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: BABEL_PLUGINS,
  });

  return ast.program.body.map((node) => {
    const startLine = node.loc?.start?.line ?? 1;
    const endLine = node.loc?.end?.line ?? startLine;
    const lineCount = endLine - startLine + 1;
    return {
      file: `${label}`,
      startLine,
      endLine,
      lineCount,
      node,
    };
  });
}

function createCandidate(source, label) {
  const forms = parseSource(source, label);
  if (forms.length === 0) {
    throw new Error(`Validation source ${label} produced no top-level forms.`);
  }
  const form = forms[0];
  const normNode = normalise(form.node);
  return {
    file: form.file,
    startLine: form.startLine,
    endLine: form.endLine,
    lineCount: form.lineCount,
    nodeCount: countNodes(normNode),
    fingerprints: fingerprint(normNode),
  };
}

export function validateDetection(options = {}) {
  const configuration = {
    metric: options.metric ?? 'jaccard',
    threshold: options.threshold,
    combinedWeight: options.combinedWeight ?? 0.5,
    fastFilterThreshold: typeof options.fastFilterThreshold === 'number' ? options.fastFilterThreshold : 0.25,
    adaptiveThreshold: Boolean(options.adaptiveThreshold),
  };
  const details = [];
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;

  for (const testCase of VALIDATION_CASES) {
    const left = createCandidate(testCase.left, `${testCase.name}-left`);
    const right = createCandidate(testCase.right, `${testCase.name}-right`);
    const pairs = findDuplicates([left, right], {
      threshold: configuration.threshold,
      metric: configuration.metric,
      combinedWeight: configuration.combinedWeight,
      fastFilterThreshold: configuration.fastFilterThreshold,
      adaptiveThreshold: configuration.adaptiveThreshold,
    });

    const predictedDuplicate = pairs.length > 0;
    const expected = Boolean(testCase.expectedDuplicate);
    const match = predictedDuplicate === expected;

    if (expected && predictedDuplicate) truePositives += 1;
    if (expected && !predictedDuplicate) falseNegatives += 1;
    if (!expected && !predictedDuplicate) trueNegatives += 1;
    if (!expected && predictedDuplicate) falsePositives += 1;

    details.push({
      name: testCase.name,
      expectedDuplicate: expected,
      predictedDuplicate,
      passed: match,
      score: pairs[0]?.score ?? 0,
      metric: configuration.metric,
      threshold: configuration.threshold,
      adaptiveThreshold: configuration.adaptiveThreshold,
    });
  }

  const totalPredicted = truePositives + falsePositives;
  const totalActualPositives = truePositives + falseNegatives;
  const precision = totalPredicted === 0 ? 0 : truePositives / totalPredicted;
  const recall = totalActualPositives === 0 ? 0 : truePositives / totalActualPositives;
  const accuracy = (truePositives + trueNegatives) / VALIDATION_CASES.length;

  return {
    configuration,
    totalCases: VALIDATION_CASES.length,
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision,
    recall,
    accuracy,
    details,
  };
}

export function formatValidationSummary(summary) {
  const lines = [
    `Validation summary: ${summary.totalCases} case(s)`,
    `  True positives: ${summary.truePositives}`,
    `  False positives: ${summary.falsePositives}`,
    `  True negatives: ${summary.trueNegatives}`,
    `  False negatives: ${summary.falseNegatives}`,
    `  Precision: ${summary.precision.toFixed(2)}`,
    `  Recall: ${summary.recall.toFixed(2)}`,
    `  Accuracy: ${summary.accuracy.toFixed(2)}`,
    `  Metric: ${summary.configuration.metric}`,
    `  Adaptive threshold: ${summary.configuration.adaptiveThreshold}`,
  ];

  return lines.join('\n');
}
