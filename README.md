# dryjs

**Structural duplicate detector for JavaScript/ES6 code.**

`dryjs` finds code with the same *shape* even when names, literals, and minor details differ. Inspired by [dry4clj](https://github.com/unclebob/dry4clj) by Robert C. Martin.

## How It Works

```
scanFiles → parseFile → normalise → fingerprint → compare → report
```

1. **Scan** – discovers all JS/MJS/JSX/TS/TSX files under the given paths
2. **Parse** – uses `@babel/parser` to extract top-level forms
3. **Normalise** – converts each form's AST into a minimal, deterministic `NormNode` tree where all identifiers → `:symbol` and all literals → `:literal`
4. **Fingerprint** – walks every sub-tree and collects a `Set<string>` of serialised sub-trees
5. **Compare** – computes Jaccard similarity over fingerprint sets for every pair
6. **Report** – outputs matches above the threshold

## Why Structural?

Two functions with different names and different variable names but the *same shape* will score `1.0`:

```js
// alpha.js
function alpha(xs) {
  const ys = xs.filter(isOdd);
  return ys.map(increment);
}

// beta.js
function beta(items) {
  const kept = items.filter(isEven);
  return kept.map(decrement);
}
```

```
DUPLICATE score=1.00
  alpha.js:2-5
  beta.js:2-5
```

Functions that share *most* of their structure score below `1.0` (e.g. `0.89`) — still worth reviewing.

## Installation

```sh
npm install
```

## Prompt organisation

Active prompt definitions live in `prompts/`, while archived prompt reports and historical prompt artifacts are stored in `prompt-history/`.

## Usage

```sh
node src/cli.mjs [options] [paths...]
```

### Options

| Flag                        | Description                                                            | Default  |
| --------------------------- | ---------------------------------------------------------------------- | -------- |
| `-t, --threshold <n>`       | Minimum similarity score                                               | `0.82` |
| `--min-lines <n>`          | Minimum source lines per candidate form                                | `4`    |
| `--min-nodes <n>`          | Minimum normalised node count                                          | `20`   |
| `--max-files <n>`          | Maximum number of files to scan                                        | —      |
| `--max-forms <n>`          | Maximum number of candidate forms to compare                           | —      |
| `--exclude <pattern>`      | Glob pattern to exclude files or directories from scanning             | —      |
| `--ignore-file <path>`     | Path to ignore file (default: `.dry4jsignore`)                         | `.dry4jsignore` |
| `--fail-on-duplicates`     | Exit with status `1` when duplicate candidates are found               | —      |
| `-f, --format <fmt>`       | Output format: `text` or `json`                                        | `text` |
| `--json`                   | Shorthand for `--format json`                                          |        |
| `-V, --version`            | Show version                                                           |        |
| `-h, --help`               | Show help                                                              |        |

### Examples

```sh
# Quickstart with the installed CLI
npx dry4js .

# Scan src/ directory (default)
node src/cli.mjs

# Scan multiple paths
node src/cli.mjs src lib

# Ignore files or directories from scanning
node src/cli.mjs --exclude 'src/**/*.test.js' --exclude 'src/vendor/**' src

# Use a custom ignore file
node src/cli.mjs --ignore-file .dry4jsignore src

# Higher threshold — only near-perfect structural matches
node src/cli.mjs --threshold 0.9 src

# Lower threshold — catch more partial matches
node src/cli.mjs --threshold 0.7 src

# JSON output for tooling / CI
node src/cli.mjs --json src

# Fail CI when duplicates are found
node src/cli.mjs --fail-on-duplicates --json src

# Tune sensitivity (skip short forms)
node src/cli.mjs --min-lines 6 --min-nodes 30 src
```

### Sample Text Output

```
DUPLICATE score=0.89
  src/billing/invoice.js:12-25
  src/billing/receipt.js:30-44

DUPLICATE score=1.00
  src/utils/alpha.js:1-6
  src/utils/beta.js:1-6
```

### Sample JSON Output

```json
{
  "candidates": [
    {
      "score": 0.89,
      "left": { "file": "src/billing/invoice.js", "startLine": 12, "endLine": 25 },
      "right": { "file": "src/billing/receipt.js", "startLine": 30, "endLine": 44 },
      "leftNodes": 88,
      "rightNodes": 91
    }
  ]
}
```

## Architecture

```
src/
  scanner.mjs      – File discovery (glob, recursive)
  parser.mjs       – @babel/parser + top-level form extraction
  normaliser.mjs   – AST → deterministic NormNode { type, children }
  fingerprinter.mjs – NormNode → Set<string> fingerprints
  comparator.mjs   – Jaccard similarity over fingerprint sets
  reporter.mjs     – Output formatting (text / JSON)
  cli.mjs          – Orchestration + CLI (commander)
  utils.mjs        – Shared helpers
```

## Development

```sh
npm install
npm test              # run all tests (Vitest)
npm run test:watch    # watch mode
npm run test:coverage # tests + coverage report
```

## Publishing

Publishing to npm requires valid npm authentication and maintainer access for `dry-4-js`.

- Authenticate with `npm login` or configure an npm token in `~/.npmrc`.
- Confirm auth with `npm whoami` before publishing.
- If you do not have publish rights, request npm maintainer access for this package.
- The release workflow uses `npm publish --access public` from the repository root.
- A successful publish also depends on passing `npm test`, since `prepublishOnly` runs the test suite.

## Testing

107 tests across 6 test files covering:

- Scanner file discovery
- Parser form extraction and error resilience
- Normaliser determinism and structural invariants
- Fingerprinter sub-tree collection and MIN_NODES filter
- Comparator Jaccard similarity and duplicate finding
- Reporter text + JSON formatting
- Full end-to-end pipeline scenarios

## License

CC-BY-NC-4.0
