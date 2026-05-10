#!/usr/bin/env node

import { runCli } from './cli.mjs';

try {
  await runCli();
} catch (error) {
  globalThis.console.error(error);
  globalThis.process.exitCode = 1;
}
