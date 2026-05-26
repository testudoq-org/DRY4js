# Prompt 8 – Improvement Audit & Implementation

You are working on the dryjs project.

Read `.github/copilot-instructions.md`, `ARCHITECTURE.md`, `PROMPT-ADDENDUM.md`, and `DEVELOPMENT-WORKFLOW.md` first.

**Branch in use:** `feature/prompt-8-improvements`

## Goals

1. Review the codebase for package configuration, CLI orchestration, error handling, testing, performance, and documentation.
2. Verify test health with Vitest and CRAP4JS.
3. Run the user-facing CLI against the repository source for dogfooding.
4. Identify practical improvements that assist the DRY structural duplicate detection workflow.

## Verification Summary

- Vitest: `124` tests passed
- CRAP report: `0` high-risk functions, `5` moderate-risk functions
- Coverage: `96.92%` statements, `97.02%` lines, `83.75%` branches
- Dogfood run: `npm exec -- dry4js --json src` completed successfully and found `1` duplicate pair in `src/normaliser.mjs`

## Key Findings

### 1) Repo & Package Configuration

- `package.json` is already in strong shape:
  - `type: "module"` is correct
  - `exports` are explicit for all main modules
  - `bin` is configured as `dry4js`
  - `files` includes only source + docs
- Suggested improvement: add `publishConfig: { "access": "public" }` if npm publishing is intended.
- Suggested improvement: consider conditional exports for future dist builds, but current dev setup is acceptable.

### 2) CLI Orchestration

- `src/cli.mjs` has good separation via `buildProgram()` and `runCli()`.
- The action handler is responsible for scanning, parsing, filtering, comparing, and reporting in a single loop. This is okay now, but it can be further decomposed for testability and performance.
- The CLI currently handles `--json` and spinner muting for JSON output.
- `node src/bin.mjs` provides a clean top-level entrypoint with proper try/catch and exit code handling.

### 3) Error Handling & Resilience

- Parser errors are caught and logged as warnings.
- Empty scan results are handled gracefully.
- Current error handling is sufficient for a CLI tool, but improvements could include:
  - definitive `process.exitCode=1` on fatal scan or parse failures
  - better distinction between recoverable parse warnings and fatal errors
  - optional `--ignore-errors` / `--strict` modes

### 4) Testing & Coverage

- Full Vitest suite passes.
- CRAP report confirms maintainable code with only moderate risk in a few functions.
- Coverage is high across the repo.
- Improvement opportunity: add snapshot coverage for the normaliser output to lock down structural shape.
- Improvement opportunity: add a CLI integration test for the actual packaged `dry4js` binary path if not already covered.

### 5) Performance & Scalability

- The current pipeline is effectively quadratic in candidate pairs for comparison.
- The `scanFiles` + `parseFile` + filter loop is straightforward, but could be improved with:
  - `--max-forms` limit
  - `--max-files` limit
  - `--max-candidates` guard
  - early filtering by source file size or form complexity
  - approximate pre-filtering before full Jaccard scoring
- `src/normaliser.mjs` and `src/fingerprinter.mjs` are already efficient enough for small-to-medium repos.

### 6) Documentation & DX

- README is strong and clearly explains the architecture.
- Missing or weak areas:
  - quickstart one-liner for `npx dry4js .`
  - explicit example command for CI-friendly JSON output
  - no `CHANGELOG.md` currently present
  - no `.dry4jsignore` or ignore pattern documentation

### 7) DRY-Specific Improvements

These improvements would directly support the DRY structural analysis mission:

- Add `--max-forms` / `--max-files` to reduce noise and protect large repositories.
- Add `--exclude` / `.dry4jsignore` support so generated files, tests, and third-party code are skipped.
- Add `--output <file>` so duplicate reports can be saved for later review.
- Add a CI-friendly `--fail-on-duplicates` flag that returns non-zero when matches are found.
- Add `--relative-paths` or normalize output to repo-relative paths for reproducible comparisons.
- Add `--profile` or `--timing` for performance diagnostics on large scans.
- Add `--debug` / `--quiet` logging modes for better CLI UX.

## Dogfood Results

- Verified the packaged binary using `npm exec -- dry4js --json src`
- Output: `1 duplicate pair(s) found`
- Duplicate pair location:
  - `src/normaliser.mjs:172-179`
  - `src/normaliser.mjs:211-217`

This confirms the runtime entrypoint is working and the tool can analyze its own source.

## Recommended Next Improvements

1. Add `--max-forms` and `--max-files` CLI limits.
2. Add ignore-path support (`--exclude`, `.dry4jsignore`).
3. Add a `--fail-on-duplicates` or CI mode for automated pipelines.
4. Add a quickstart one-liner and JSON output example to `README.md`.
5. Add a small `CHANGELOG.md` placeholder.
6. Add a packaged CLI integration test that exercises the installed `dry4js` binary.

## Notes for this branch

- This review is documented only in `PROMPT-8-IMPROVEMENTS.md`.
- No commit or merge has been performed.
- The branch in use is `feature/prompt-8-improvements`.
