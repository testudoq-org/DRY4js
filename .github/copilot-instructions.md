# dryjs – Copilot Instructions

## Project Overview
`dryjs` is a **structural** (not textual) duplicate detector for JavaScript/ES6 code.
It finds code with the **same shape** even when names, literals, and minor details differ.
Inspired by https://github.com/unclebob/dry4clj

## Architecture
```
scanFiles → parseFile → normalise → fingerprint → compareForms → report
```

| Module          | Responsibility                                   |
|-----------------|--------------------------------------------------|
| scanner.mjs     | File discovery (glob, recursive)                 |
| parser.mjs      | Babel parsing + top-level form extraction        |
| normaliser.mjs  | AST → deterministic NormNode { type, children }  |
| fingerprinter.mjs | NormNode → Set<string> fingerprints             |
| comparator.mjs  | Jaccard similarity over fingerprint sets         |
| reporter.mjs    | Output formatting (text / JSON)                  |
| cli.mjs         | Orchestration + CLI (commander)                  |
| utils.mjs       | Shared helpers                                   |

## Critical Rules

### Fixed Child Traversal Order
Normalisation MUST use a **fixed, deterministic child order**. Never rely on
`Object.keys()` or property enumeration order. Use explicit property lists.

### Normalisation Rules
- Replace all **identifiers** (variable names, function names, parameter names) with the marker `:symbol`
- Replace all **literals** (strings, numbers, booleans, null, regex) with the marker `:literal`
- Preserve **structural tokens**: type tags like `FunctionDeclaration`, `BlockStatement`, `CallExpression`, etc.
- In a **call expression**: preserve the callee shape (head position) but replace it with its normalised form
- Keep collection/block shape intact

### Fingerprinting
- Walk every sub-tree of the normalised form
- Serialise each sub-tree with `JSON.stringify` and add to a `Set`
- Result is `Set<string>`

### Similarity
Jaccard similarity: `|A ∩ B| / |A ∪ B|`

## Testing
- Use **Vitest** for all tests
- Test files: `test/*.test.mjs`
- Renamed-but-structurally-identical functions MUST produce the same normalised output
- Fingerprints MUST be deterministic across runs

## Error Handling
- Never crash on a single bad file — log a warning and continue

## Node version
Node.js 20+, ES modules (`.mjs`), no CommonJS
