#!/usr/bin/env node
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

const DEFAULT_THRESHOLD = 0.82;
const DEFAULT_MIN_LINES = 4;
const DEFAULT_MIN_NODES = 20;

const program = new Command();

program
  .name('dryjs')
  .description('Structural duplicate detector for JavaScript/ES6 code')
  .version('0.1.0')
  .argument('[paths...]', 'Files or directories to scan', ['src'])
  .option('-t, --threshold <n>', 'Minimum similarity score', parseFloat, DEFAULT_THRESHOLD)
  .option('--min-lines <n>', 'Minimum source lines in a candidate form', parseInt, DEFAULT_MIN_LINES)
  .option('--min-nodes <n>', 'Minimum normalised node count', parseInt, DEFAULT_MIN_NODES)
  .option('-f, --format <fmt>', 'Output format: text or json', 'text')
  .option('--json', 'Shorthand for --format json')
  .action(async (paths, opts) => {
    const format = opts.json ? 'json' : opts.format;
    const threshold = opts.threshold;
    const minLines = opts.minLines;
    const minNodes = opts.minNodes;

    const spinner = ora({ text: 'Scanning files…', isSilent: format === 'json' }).start();

    // 1. Discover files
    const files = await scanFiles(paths);

    if (files.length === 0) {
      spinner.warn('No source files found.');
      process.exit(0);
    }

    spinner.text = `Parsing ${files.length} file(s)…`;

    // 2. Parse + normalise + fingerprint each top-level form
    const entries = [];

    for (const file of files) {
      const forms = parseFile(file);

      for (const form of forms) {
        if (form.lineCount < minLines) continue;

        const normNode = normalise(form.node);
        const nodeCount = countNodes(normNode);

        if (nodeCount < minNodes) continue;

        const fps = fingerprint(normNode);

        entries.push({
          file: form.file,
          startLine: form.startLine,
          endLine: form.endLine,
          lineCount: form.lineCount,
          nodeCount,
          fingerprints: fps,
        });
      }
    }

    spinner.text = `Comparing ${entries.length} candidate form(s)…`;

    // 3. Compare
    const pairs = findDuplicates(entries, { threshold });

    spinner.succeed(`Done — ${pairs.length} duplicate pair(s) found.`);

    // 4. Report
    report(pairs, format);
  });

program.parse();
