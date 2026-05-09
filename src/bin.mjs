#!/usr/bin/env node

import { runCli } from './cli.mjs';

runCli().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
