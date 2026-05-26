#!/usr/bin/env node

import { runCli } from './cli.mjs';

try {
  const result = await runCli();
  if (result && typeof result.exitCode === 'number') {
    globalThis.process.exitCode = result.exitCode;
  }
} catch (error) {
  globalThis.console.error(error);
  globalThis.process.exitCode = 1;
}
