# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-05-26

### Added

- `--max-files` support to limit the number of scanned files.
- `--max-forms` support to limit the number of candidate forms compared.
- `--exclude <pattern>` CLI flag for ignore-glob exclusions.
- `.dry4jsignore` support for ignore patterns loaded from a file.
- `--ignore-file <path>` CLI option to customize the ignore file location.
- `--fail-on-duplicates` CLI flag to fail with exit code `1` when duplicates are detected.
- README quickstart examples for `npx dry4js .`, ignore patterns, and CI mode.
- `publishConfig.access` added to `package.json` for npm publishing hygiene.
- Packaged CLI integration tests to validate `src/bin.mjs` behavior.
