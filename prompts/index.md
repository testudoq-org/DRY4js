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
r.You are working on the dryjs project.

Switch to **new branch** `feature/final-tests-polish`.

- Add comprehensive end-to-end test in `test/e2e.test.mjs`
- Run full test suite with coverage
- Polish README.md with usage examples
- Final fixes

Commit when everything passes, then provide instructions to merge to master


Prompt 7 – CRAP Analysis, Test Coverage Improvement & Guardrail Review
MarkdownYou are working on the dryjs project.

Read `.github/copilot-instructions.md`, `ARCHITECTURE.md`, `PROMPT-ADDENDUM.md`, and `DEVELOPMENT-WORKFLOW.md` first.

**Switch to a new branch** called `feature/crap-analysis-coverage`.

### Task 1: Install CRAP Tool
Install the latest version of `crap4js` (currently 1.0.1-beta.3) as a **dev dependency**:

```bash
npm install --save-dev crap4js@1.0.1-beta.3
Update package.json scripts to include:
JSON"test:crap": "crap4js --src src --coverage ./coverage",
"report": "npm run test:coverage && npm run test:crap"
Task 2: Run Full Test Suite + CRAP Report

Run the full test suite with coverage: npm run test:coverage
Then run the CRAP report
Analyze the CRAP report output

Task 3: Identify & Improve Weak Areas
Determine areas with:

High CRAP scores (risky code)
Low test coverage
High cyclomatic complexity

Prioritize improvements in this order:

src/normaliser.mjs (most critical module)
src/parser.mjs
src/fingerprinter.mjs
src/comparator.mjs
src/cli.mjs

Add missing tests (unit + integration) to bring coverage higher and reduce CRAP scores.
Task 4: Review All Prompt/Guardrail Files
Review these files and suggest concrete improvements:

.github/copilot-instructions.md
ARCHITECTURE.md
PROMPT-ADDENDUM.md
DEVELOPMENT-WORKFLOW.md

Look for:

Outdated instructions
Missing constraints
Opportunities for clarity
New best practices we should add now that the project is built

Final Deliverables
After improvements:

Commit all changes with clear messages
Provide a summary report containing:
Before/After CRAP scores for key files
Test coverage percentage
List of new tests added
Recommended updates to guardrail files (with full proposed new content)


Only commit when tests pass and CRAP scores have improved.
text---

### Recommended Usage

1. **Create the branch** manually first (recommended on Windows):
   ```powershell
   git checkout master
   git pull
   git checkout -b feature/crap-analysis-coverage
```

---

#### **Prompt 8 – Improvement Audit & Implementation**

Markdown

```
You are working on the dryjs project.

Read `.github/copilot-instructions.md`, `ARCHITECTURE.md`, `PROMPT-ADDENDUM.md`, and `DEVELOPMENT-WORKFLOW.md` first.

Switch to **new branch** `feature/prompt-9`.

Review the repository for package configuration, CLI orchestration, error handling, test coverage, performance, and documentation.

Use the following executive summary as the starting analysis point:

- ESM configuration and entry points
- CLI orchestration and async flow
- Error handling and resilience
- Testing gaps and edge cases
- Performance and scalability
- Documentation and DX

Update package metadata, improve CLI structure, add integration tests, document the plan, and create a concise improvement backlog.

Create `PROMPT-8-IMPROVEMENTS.md` containing the detailed review and implementation tasks.
```
```
