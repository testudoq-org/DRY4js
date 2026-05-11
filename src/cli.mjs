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
    .option('-f, --format <fmt>', 'Output format: text or json', 'text')
    .option('--json', 'Shorthand for --format json')
    .action(async (paths, opts) => {
      const format = opts.json ? 'json' : opts.format;
      const threshold = opts.threshold;
      const minLines = opts.minLines;
      const minNodes = opts.minNodes;

      const spinner = spinnerFactory({ text: 'Scanning files…', isSilent: format === 'json' }).start();

      const files = await scanFiles(paths);
      if (files.length === 0) {
        spinner.warn('No source files found.');
        result = { exitCode: 0, files, entries: [], pairs: [], format };
        return result;
      }

      spinner.text = `Parsing ${files.length} file(s)…`;

      const entries = [];
      for (const file of files) {
        const forms = parseFile(file);

        for (const form of forms) {
          if (form.lineCount < minLines) continue;

          const normNode = normalise(form.node);
          const nodeCount = countNodes(normNode);
          if (nodeCount < minNodes) continue;

          entries.push({
            file: form.file,
            startLine: form.startLine,
            endLine: form.endLine,
            lineCount: form.lineCount,
            nodeCount,
            fingerprints: fingerprint(normNode),
          });
        }
      }

      spinner.text = `Comparing ${entries.length} candidate form(s)…`;

      const pairs = findDuplicates(entries, { threshold });
      spinner.succeed(`Done — ${pairs.length} duplicate pair(s) found.`);

      reporter(pairs, format);
      result = { exitCode: 0, files, entries, pairs, format };
      return result;
    });

  return { program, getResult: () => result };
}

export async function runCli(argv = globalThis.process.argv, deps = {}) {
  const { program, getResult } = buildProgram(deps);
  await program.parseAsync(argv);
  return getResult();
}
