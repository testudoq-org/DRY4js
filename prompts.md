### **Full Set of Enhanced Prompts**

#### **Master Prompt 0 – Project Initialization**

Markdown

```
You are building `dryjs`.

**Environment**: Windows 11, VS Code, GitHub Copilot/RooCode, Node.js 20+, PowerShell.

Create the complete project scaffolding with this exact structure:

- `.github/copilot-instructions.md`
- `ARCHITECTURE.md`
- `PROMPT-ADDENDUM.md`
- `DEVELOPMENT-WORKFLOW.md`
- `package.json` (with Vitest + Vite config scripts)
- `vite.config.mjs` (with ESM + globals support for Vitest)
- All `src/*.mjs` skeleton files with JSDoc
- `test/` folder
- `.gitignore`, `README.md`

Use the exact content I provided for the guardrail files.

After creation:
- Run `npm install`
- Initial commit on `master`: "chore: initial scaffolding + guardrails + vitest"
- Create and switch to branch `feature/scaffold-complete`

Confirm by showing the folder structure and `npm test` output.
```

---

#### **Prompt 1 – Scanner + Parser**

Markdown

```
You are working on the dryjs project.

Read `.github/copilot-instructions.md`, `ARCHITECTURE.md`, `PROMPT-ADDENDUM.md`, and `DEVELOPMENT-WORKFLOW.md` first. Confirm by summarising the parser and child order.

Switch to **new branch** `feature/scanner-parser`.

Implement `src/scanner.mjs` and `src/parser.mjs`.

Create `test/parser.test.mjs` with real tests.

Run `npm test`. Iterate until all tests pass.

Commit only when tests pass: "feat: scanner and parser with Vitest tests"
```

#### **Prompt 2 – Normaliser**

Markdown

```
You are working on the dryjs project. Read all guardrail files first.

Switch to **new branch** `feature/normaliser`.

Implement `src/normaliser.mjs` (normalise + serialise) following the exact rules.

Create strong tests in `test/normaliser.test.mjs` proving renamed functions produce identical output.

Run `npm test` and iterate until passing.

Commit: "feat: deterministic normaliser + tests"
```

#### **Prompt 3 – Fingerprinter**

Markdown

```
You are working on the dryjs project. Read guardrails first.

Switch to **new branch** `feature/fingerprinter`.

Implement `src/fingerprinter.mjs`.

Update tests to verify identical fingerprints for equivalent structures.

Run `npm test` → iterate until passing.

Commit: "feat: fingerprinter + tests"
```

#### **Prompt 4 – Comparator + Reporter**

Markdown

```
You are working on the dryjs project. Read guardrails first.

Switch to **new branch** `feature/comparator-reporter`.

Implement `src/comparator.mjs` and `src/reporter.mjs`.

Add relevant tests.

Run `npm test` until passing.

Commit: "feat: comparator and reporter"
```

#### **Prompt 5 – CLI Orchestration**

Markdown

```
You are working on the dryjs project. Read guardrails first.

Switch to **new branch** `feature/cli-orchestration`.

Implement `src/cli.mjs` with commander.

Wire up the full pipeline with progress spinner.

Support all flags.

Run `npm test` until the full flow works.

Commit: "feat: complete CLI orchestration"
```

#### **Prompt 6 – Final Tests + Polish**

Markdown

```
You are working on the dryjs project.

Switch to **new branch** `feature/final-tests-polish`.

- Add comprehensive end-to-end test in `test/e2e.test.mjs`
- Run full test suite with coverage
- Polish README.md with usage examples
- Final fixes

Commit when everything passes, then provide instructions to merge to maste
```
