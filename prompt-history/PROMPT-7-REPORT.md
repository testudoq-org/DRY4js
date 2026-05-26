# Prompt 7 Report

## Branch

`feature/crap-analysis-coverage`

## What changed

### Code and configuration
- Installed `crap4js@1.0.1-beta.3` as a dev dependency.
- Added scripts:
  - `npm run test:crap`
  - `npm run report`
- Refactored `src/normaliser.mjs` from a large `switch` to a deterministic dispatch table.
- Added support for `ClassPrivateMethod` normalisation.
- Reused `countNodes` from `src/utils.mjs` inside `src/fingerprinter.mjs`.
- Refactored `src/cli.mjs` into an importable module with exported `buildProgram()` and `runCli()`.
- Added `src/bin.mjs` as the executable wrapper and updated `package.json` to use it as the package bin.
- Updated coverage config to exclude only `src/bin.mjs`.

### Tests
- Expanded `test/normaliser.test.mjs` with advanced construct coverage:
  - switch/default cases
  - do/while, for-in, for-of
  - labels, break/continue, throw
  - destructuring, defaults, rest params
  - export forms without inline declarations
  - TypeScript declarations
  - private fields and private methods
  - optional chaining, tagged templates, await/yield, sequences
  - JSX fragments and spread children
- Expanded `test/comparator.test.mjs` to cover `report()`.
- Rebuilt `test/cli.test.mjs` to cover:
  - documented defaults
  - default text output
  - JSON shorthand and numeric filters
  - no-source-files path
- Existing `test/e2e.test.mjs` remained in place and continues to pass.

## Metrics

### Coverage

| Metric | Before | After |
|---|---:|---:|
| Overall statement coverage | 89.48% | 97.73% |
| Overall branch coverage | 71.15% | 94.40% |
| Overall function coverage | 81.57% | 89.65% |
| Overall line coverage | 89.48% | 97.73% |

### Key file coverage

| File | Before | After |
|---|---:|---:|
| `src/normaliser.mjs` | 82.14% stmts / 60.74% branch | 97.95% stmts / 94.87% branch |
| `src/parser.mjs` | 100% stmts / 80% branch | 100% stmts / 80% branch |
| `src/fingerprinter.mjs` | 100% | 100% |
| `src/comparator.mjs` | 100% | 100% |
| `src/cli.mjs` | excluded / effectively unmeasured | 89.36% stmts / 92.3% branch |
| `src/reporter.mjs` | 90.62% | 100% |
| `src/utils.mjs` | excluded / unmeasured | 100% |

### CRAP summary

#### Before
- `normaliseNode` in `src/normaliser.mjs`: **137.2** (`high`)
- High-risk functions: **1**
- Moderate-risk functions: **6**

#### After
- `normaliseNode` in `src/normaliser.mjs`: **2.0** (`low`)
- High-risk functions: **0**
- Moderate-risk functions: **5**

### Notable CRAP improvements

| Function | Before | After |
|---|---:|---:|
| `normaliseNode` (`src/normaliser.mjs`) | 137.2 | 2.0 |
| `report` (`src/reporter.mjs`) | 4.5 | 2.0 |
| CLI runtime path (`src/cli.mjs`) | N/A / excluded | measured, moderate only |

## Test totals
- Before: 107 tests
- After: 122 tests
- Net new passing tests: **15**

## Notes from Prompt 7 execution
- The Prompt 7 example command for `crap4js` was outdated for `1.0.1-beta.3`.
- Working command:
  - `crap4js --coverage-dir ./coverage src`
- `crap4js` now works through `npm run test:crap`.
- `npm run report` completes successfully and produces the CRAP report.
- Existing `npm audit` findings are from the pre-existing older Vitest/Vite toolchain, not from `crap4js`.

## Recommended guardrail updates

The following are suggested updates, not applied changes.

### Proposed `.github/copilot-instructions.md`

```md
# dryjs - Copilot Instructions

## Project Overview
`dryjs` is a structural (not textual) duplicate detector for JavaScript/TypeScript code.
It finds code with the same shape even when names, literals, and minor details differ.
Inspired by https://github.com/unclebob/dry4clj

## Architecture
scanFiles -> parseFile -> normalise -> fingerprint -> compareForms -> report

| Module | Responsibility |
|---|---|
| `scanner.mjs` | File discovery (glob, recursive) |
| `parser.mjs` | Babel parsing + top-level form extraction |
| `normaliser.mjs` | AST -> deterministic `NormNode { type, children }` |
| `fingerprinter.mjs` | `NormNode` -> `Set<string>` fingerprints |
| `comparator.mjs` | Jaccard similarity over fingerprint sets |
| `reporter.mjs` | Output formatting (text / JSON) |
| `cli.mjs` | Importable CLI orchestration logic |
| `bin.mjs` | Executable wrapper for the CLI |
| `utils.mjs` | Shared helpers |

## Critical Rules

### Fixed Child Traversal Order
Normalisation MUST use a fixed, deterministic child order.
Never rely on `Object.keys()` or property enumeration order.
Use explicit property lists or explicit node-type dispatch.

### Normalisation Rules
- Replace all identifiers and private names with `:symbol`
- Replace all literals with `:literal`
- Preserve structural tokens such as `FunctionDeclaration`, `BlockStatement`, `CallExpression`, etc.
- In call expressions, preserve the callee/head position shape
- Keep collection, block, and control-flow structure intact
- Unknown nodes should fall back to `{ type: node.type, children: [] }` instead of throwing

### CLI/Testability Rule
Keep importable logic and executable wrappers separate:
- `cli.mjs` should contain testable orchestration logic
- `bin.mjs` should contain runtime-only executable bootstrap code
Do not place shebang-based runtime wrappers in files that are imported by tests.

### Fingerprinting
- Walk every sub-tree of the normalised form
- Serialise each sub-tree with `JSON.stringify`
- Add each serialised subtree to a `Set<string>`
- Skip trivial subtrees below the configured node threshold

### Similarity
Jaccard similarity: `|A ∩ B| / |A ∪ B|`

## Testing
- Use Vitest for all tests
- Test files: `test/*.test.mjs`
- Renamed-but-structurally-identical functions must produce identical normalised output
- Fingerprints must be deterministic across runs
- CLI logic should be testable without spawning a subprocess
- End-to-end coverage should include malformed-file resilience

## Error Handling
- Never crash on a single bad file; warn and continue
- Avoid `process.exit()` in importable logic; return structured results where possible

## Tooling Notes
- `crap4js@1.0.1-beta.3` uses `--coverage-dir <dir>` and path filters, not `--src/--coverage`
- When changing dependencies, rerun coverage and CRAP reports

## Node version
Node.js 20+, ES modules only, no CommonJS
```

### Proposed `ARCHITECTURE.md`

```md
# dryjs Architecture

## Data Flow
scanFiles -> parseFile -> normalise -> fingerprint -> compareForms -> report

## Runtime Entry Points
- `src/cli.mjs` contains the importable CLI orchestration logic
- `src/bin.mjs` contains the executable bootstrap wrapper

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `scanner.mjs` | File discovery |
| `parser.mjs` | Babel parsing + form extraction |
| `normaliser.mjs` | AST -> deterministic NormNode |
| `fingerprinter.mjs` | NormNode -> Set<string> fingerprints |
| `comparator.mjs` | Jaccard similarity + duplicate pairing |
| `reporter.mjs` | Output formatting |
| `cli.mjs` | CLI orchestration logic |
| `bin.mjs` | Executable entry wrapper |
| `utils.mjs` | Shared helpers |

## Design Constraints
- Deterministic normalisation is non-negotiable
- Normalisation should use explicit node dispatch, not reflective traversal
- CLI logic should remain importable for tests
- Runtime wrappers should stay tiny and isolated
- One bad file must never crash the scan
```

### Proposed `PROMPT-ADDENDUM.md`

```md
# dryjs Prompt Addendum

## Why This Design
- Normalisation must be 100% deterministic, so fixed child order is mandatory
- Structural (not textual) comparison is the core value
- Pure functions and clear module boundaries improve reliability
- One bad file must never crash the whole scan

## Additional Lessons
- Keep executable wrappers separate from importable orchestration logic
- Prefer dispatch tables or explicit handlers over giant switches when complexity grows
- Prompt examples that depend on third-party tools should match the installed tool version
- Coverage should measure real logic modules; exclude only tiny bootstrap wrappers when justified
```

### Proposed `DEVELOPMENT-WORKFLOW.md`

```md
# dryjs Development Workflow

## Environment
- Windows 11, VS Code, Node.js 20+, PowerShell

## Branching Strategy
- `master` - stable, tested code only
- `feature/<name>` - one feature per branch, merged after tests pass

## Workflow Per Feature
1. Switch to or create the feature branch
2. Implement the feature in `src/*.mjs`
3. Write or expand tests in `test/*.test.mjs`
4. Run `npm test` and iterate until all tests pass
5. Run `npm run test:coverage` for non-trivial changes
6. When complexity-sensitive code changes, run `npm run test:crap`
7. Commit with a conventional commit message
8. Only merge to `master` when tests are green and risk has not regressed

## Commands
```powershell
npm test
npm run test:coverage
npm run test:crap
npm run report
```

## Quality Gates
- No high-risk CRAP functions in core modules
- New CLI behavior should be covered by tests
- Malformed input must be handled without crashing
- Deterministic normalisation behavior must be preserved

## Commit Message Convention
- `feat:` - new feature
- `fix:` - bug fix
- `chore:` - tooling, scaffolding, config
- `test:` - tests only
- `refactor:` - code change with no behaviour change
```

## Codacy note

Codacy analysis was attempted after each edit, but the local MCP-backed Codacy tool failed consistently with:
- `Command failed: wsl --status`

Recommended troubleshooting:
1. Reset the Codacy MCP integration in the extension.
2. In GitHub Copilot settings, verify MCP servers are enabled.
3. If needed, review:
   - https://github.com/settings/copilot/features
   - or the organization Copilot settings page
4. If the issue persists, contact Codacy support.
