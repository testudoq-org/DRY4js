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

## Usage

```sh
npx dryjs [options] [paths...]
```

### Options

```
-t, --threshold <n>   Minimum similarity score (default: 0.82)
    --min-lines <n>   Minimum source lines per candidate form (default: 4)
    --min-nodes <n>   Minimum normalised node count (default: 20)
-f, --format <fmt>    Output format: text or json (default: text)
    --json            Shorthand for --format json
-V, --version         Show version
-h, --help            Show help
```

### Examples

```sh
# Scan the src/ directory (default)
node src/cli.mjs

# Scan multiple paths with a higher threshold
node src/cli.mjs --threshold 0.9 src test

# JSON output
node src/cli.mjs --json src
```

### Sample Output

```
DUPLICATE score=0.89
  src/billing/invoice.js:12-25
  src/billing/receipt.js:30-44
```

## Development

```sh
npm install
npm test
npm run test:coverage
```

## License

MIT
