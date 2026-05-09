
#### **`ARCHITECTURE.md`**

```markdown
# dryjs Architecture

## Data Flow
scanFiles → parseFile → normalise → fingerprint → compareForms → report

## Module Responsibilities

| Module                | Responsibility                          |
|-----------------------|-----------------------------------------|
| scanner.mjs           | File discovery                          |
| parser.mjs            | Babel parsing + form extraction         |
| normaliser.mjs        | AST → deterministic NormNode            |
| fingerprinter.mjs     | NormNode → Set<string> fingerprints     |
| comparator.mjs        | Jaccard similarity                      |
| reporter.mjs          | Output formatting                       |
| cli.mjs               | Orchestration + CLI                     |
| utils.mjs             | Shared helpers                          |
```
