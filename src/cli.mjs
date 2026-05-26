/**
 * cli.mjs
 * Orchestration + CLI entry point (commander).
 * Wires up the full pipeline: scan → parse → normalise → fingerprint → compare → report
 */

import { Command } from 'commander';
import ora from 'ora';
import { scanFiles } from './scanner.mjs';
import { parseFile } from './parser.mjs';
import { normalise } from './normaliser.mjs';
import { fingerprint, countNodes } from './fingerprinter.mjs';
import { findDuplicates } from './comparator.mjs';
import { report } from './reporter.mjs';

export const DEFAULT_THRESHOLD = 0.82;
export const DEFAULT_MIN_LINES = 4;
export const DEFAULT_MIN_NODES = 20;

function parseInteger(value) {
  return Number.parseInt(value, 10);
}

function collect(value, previous) {
  return previous.concat(value);
}

function createCandidateEntry(form) {
  const normNode = normalise(form.node);
  const nodeCount = countNodes(normNode);
  return {
    file: form.file,
    startLine: form.startLine,
    endLine: form.endLine,
    lineCount: form.lineCount,
    nodeCount,
    fingerprints: fingerprint(normNode),
  };
}

function collectCandidates(files, { minLines, minNodes, maxForms = Infinity }) {
  const entries = [];

  for (const file of files) {
    const forms = parseFile(file);

    for (const form of forms) {
      if (entries.length >= maxForms) return entries;
      if (form.lineCount < minLines) continue;

      const candidate = createCandidateEntry(form);
      if (candidate.nodeCount < minNodes) continue;

      entries.push(candidate);
    }
  }

  return entries;
}

function limitFiles(files, maxFiles, spinner) {
  if (typeof maxFiles !== 'number' || files.length <= maxFiles) return files;
  spinner.warn(`Limiting scan to first ${maxFiles} file(s) from ${files.length}.`);
  return files.slice(0, maxFiles);
}

function buildResult({ files, entries, pairs, format, failOnDuplicates, spinner }) {
  const exitCode = failOnDuplicates && pairs.length > 0 ? 1 : 0;
  if (failOnDuplicates && pairs.length > 0) {
    spinner.warn('Duplicate candidates found; exiting with code 1 due to --fail-on-duplicates.');
  }

  spinner.succeed(`Done — ${pairs.length} duplicate pair(s) found.`);
  return { exitCode, files, entries, pairs, format };
}

async function executeScan(paths, opts, spinnerFactory, reporter) {
  const format = opts.json ? 'json' : opts.format;
  const threshold = opts.threshold;
  const minLines = opts.minLines;
  const minNodes = opts.minNodes;
  const maxFiles = opts.maxFiles;
  const maxForms = opts.maxForms;
  const exclude = opts.exclude || [];
  const ignoreFile = opts.ignoreFile;
  const failOnDuplicates = Boolean(opts.failOnDuplicates);

  const spinner = spinnerFactory({ text: 'Scanning files…', isSilent: format === 'json' }).start();

  let files = await scanFiles(paths, { exclude, ignoreFile });
  if (files.length === 0) {
    spinner.warn('No source files found.');
    return { exitCode: 0, files, entries: [], pairs: [], format };
  }

  files = limitFiles(files, maxFiles, spinner);
  spinner.text = `Parsing ${files.length} file(s)…`;

  const entries = collectCandidates(files, { minLines, minNodes, maxForms });
  if (typeof maxForms === 'number' && entries.length >= maxForms) {
    spinner.warn(`Reached max forms limit of ${maxForms}. Some forms were skipped.`);
  }

  spinner.text = `Comparing ${entries.length} candidate form(s)…`;
  const pairs = findDuplicates(entries, { threshold });
  const result = buildResult({ files, entries, pairs, format, failOnDuplicates, spinner });

  reporter(pairs, format);
  return result;
}

export function buildProgram({ spinnerFactory = (options) => ora(options), reporter = report } = {}) {
  const program = new Command();
  let result = null;

  program
    .name('dryjs')
    .description('Structural duplicate detector for JavaScript/ES6 code')
    .version('0.1.0')
    .argument('[paths...]', 'Files or directories to scan', ['src'])
    .option('-t, --threshold <n>', 'Minimum similarity score', Number.parseFloat, DEFAULT_THRESHOLD)
    .option('--min-lines <n>', 'Minimum source lines in a candidate form', parseInteger, DEFAULT_MIN_LINES)
    .option('--min-nodes <n>', 'Minimum normalised node count', parseInteger, DEFAULT_MIN_NODES)
    .option('--max-files <n>', 'Maximum number of files to scan', parseInteger)
    .option('--max-forms <n>', 'Maximum number of candidate forms to compare', parseInteger)
    .option('--exclude <pattern>', 'Glob pattern to exclude from scanning', collect, [])
    .option('--ignore-file <path>', 'Path to an ignore file', '.dry4jsignore')
    .option('--fail-on-duplicates', 'Exit with status 1 when duplicates are found')
    .option('-f, --format <fmt>', 'Output format: text or json', 'text')
    .option('--json', 'Shorthand for --format json')
    .action(async (paths, opts) => {
      result = await executeScan(paths, opts, spinnerFactory, reporter);
      return result;
    });

  return { program, getResult: () => result };
}

export async function runCli(argv = globalThis.process.argv, deps = {}) {
  const { program, getResult } = buildProgram(deps);
  await program.parseAsync(argv);
  return getResult();
}
