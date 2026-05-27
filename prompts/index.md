### **Full Set of Enhanced Prompts**

---

#### Prompt 9.1 – Improve Existing Jaccard + Add Complementary Metrics

```
You are improving the DRY4js code duplication detector.

Current approach: AST normalization (removing identifiers, literals, etc.) → fingerprint sets → Jaccard similarity.

Requirements:
- Keep the core simple and fast.
- Reduce false positives (don't flag superficially similar but semantically different code).
- Reduce false negatives (catch more real duplicates).
- Stay in pure ESM Node.js (.mjs), no heavy dependencies.

Tasks:
1. Suggest adding 1-2 lightweight complementary similarity metrics (Dice Coefficient and/or Cosine on simple frequency vectors) as optional alternatives or combined score.
2. Propose a simple combined score: e.g. (Jaccard + Dice) / 2 or weighted average.
3. Add a `--similarity-metric` CLI flag (jaccard | dice | combined) with good defaults.
4. Provide concrete code changes for:
   - New metric functions in a new file or existing normaliser/fingerprinter module.
   - How to integrate into the comparison step.
   - Updated threshold logic (suggest sensible defaults, e.g. Jaccard 0.75+, Combined 0.78+).
5. Show how to minimize false positives (e.g. minimum node count filter, structural depth check).

Output only the code diffs/snippets + short explanation for each change.
```

---

#### Prompt 9.2 – Hybrid Fast Filter + Accurate Second Stage

**Status**: Completed — stage 1 fast size-based filtering plus stage 2 fingerprint comparison implemented with `--fast-filter-threshold` and `--max-candidates`.

```
Enhance the DRY4js duplication detector with a simple two-stage pipeline to improve speed and accuracy without complexity.

Current: Full pairwise Jaccard on all normalized forms.

New approach:
- Stage 1 (fast filter): Use a cheap metric (e.g. token count similarity, simple Dice on node type counts, or size-based filtering) to discard clearly dissimilar pairs.
- Stage 2: Run full AST fingerprint Jaccard only on surviving candidate pairs.

Requirements:
- Keep it simple and deterministic.
- Minimize false negatives (make Stage 1 recall very high).
- Reduce false positives via stricter Stage 2.
- Add `--max-candidates` or `--min-nodes` flags.

Provide:
- Code structure for the two-stage comparator.
- Exact functions to add.
- Suggested thresholds.
- How this integrates into the existing pipeline (scanner → parser → normaliser → fingerprinter → comparator).

Focus on maintainability. Use only built-in Node APIs + existing dependencies.
```

---

#### Prompt 9.3 – Better Normalization to Reduce False Positives/Negatives

**Status**: Completed — improved normalization context, stable symbol mapping, and optional semantic literal handling in `src/normaliser.mjs`.

```
Review and improve the AST normalization logic in DRY4js to get better duplication detection accuracy.

Current normalization removes identifiers, literals, etc.

Suggestions to explore:
- Consistent variable renaming instead of full removal (e.g. var0, var1).
- Preserve some structural information (control flow keywords, nesting depth).
- Add optional "semantic mode" that keeps certain literals (numbers, booleans) or normalizes them smarter.
- Add minimum structural similarity checks (e.g. similar number of control flow nodes).

Goal: Reduce both false positives (similar-looking but different logic) and false negatives (real duplicates missed due to over-normalization).

Provide concrete code examples for improved normalizeFunction() or equivalent, including before/after comparison on sample code.
```

---

#### Prompt 9.4 – Threshold Tuning + Validation Strategy

**Status**: Completed — added built-in `--validate` runner, validation corpus, precision/recall summary, and optional adaptive threshold support.

```
Help improve duplication detection reliability in DRY4js.

Tasks:
1. Suggest a smart threshold strategy (static + optional adaptive based on file size or complexity).
2. Propose adding a small validation/test suite with known true duplicate pairs and true non-duplicate pairs.
3. Create a command like `dry4js --validate` that runs against a test corpus and prints precision/recall estimates.
4. Recommend minimum node count, minimum function length, and other filters to avoid noisy results.

Provide:
- Code for the validation runner.
- Sample test cases (as JavaScript strings).
- Updated reporting logic that shows confidence score per reported duplicate.
```

---

#### Prompt 9.5 – Overall Balanced Improvement Plan

**Status**: Pending

```
Give me a minimal, high-impact improvement plan for DRY4js duplication detection.

Constraints:
- Must stay simple (prefer < 300 lines of new code total).
- Must reduce both false positives and false negatives.
- Prefer deterministic over ML/LLM approaches.
- Build on existing AST normalization + fingerprinting.

Propose the top 3 highest-leverage changes with:
- Priority order
- Expected impact on accuracy
- Effort level
- Code sketch for each

Focus especially on combining Jaccard with one complementary metric and adding a light pre-filter.
```

---

#### **Prompt 8 – Improvement Audit & Implementation** ✅ Completed

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

---

#### **Prompt 7 – CRAP Analysis, Test Coverage Improvement & Guardrail Review** ✅ Completed

Markdown

```
You are working on the dryjs project.

Read `.github/copilot-instructions.md`, `ARCHITECTURE.md`, `PROMPT-ADDENDUM.md`, and `DEVELOPMENT-WORKFLOW.md` first.

**Switch to a new branch** called `feature/crap-analysis-coverage`.

### Task 1: Install CRAP Tool
Install the latest version of `crap4js` (currently 1.0.1-beta.3) as a **dev dependency**:

```bash
npm install --save-dev crap4js@1.0.1-beta.3
```

Update package.json scripts to include:

```json
"test:crap": "crap4js --src src --coverage ./coverage",
"report": "npm run test:coverage && npm run test:crap"
```

### Task 2: Run Full Test Suite + CRAP Report

Run the full test suite with coverage: `npm run test:coverage`
Then run the CRAP report
Analyze the CRAP report output

### Task 3: Identify & Improve Weak Areas

Determine areas with:

- High CRAP scores (risky code)
- Low test coverage
- High cyclomatic complexity

Prioritize improvements in this order:

- `src/normaliser.mjs` (most critical module)
- `src/parser.mjs`
- `src/fingerprinter.mjs`
- `src/comparator.mjs`
- `src/cli.mjs`

Add missing tests (unit + integration) to bring coverage higher and reduce CRAP scores.

### Task 4: Review All Prompt/Guardrail Files

Review these files and suggest concrete improvements:

- `.github/copilot-instructions.md`
- `ARCHITECTURE.md`
- `PROMPT-ADDENDUM.md`
- `DEVELOPMENT-WORKFLOW.md`

Look for:

- Outdated instructions
- Missing constraints
- Opportunities for clarity
- New best practices we should add now that the project is built

Final Deliverables
After improvements:

- Commit all changes with clear messages
- Provide a summary report containing:
  - Before/After CRAP scores for key files
  - Test coverage percentage
  - List of new tests added
  - Recommended updates to guardrail files (with full proposed new content)

Only commit when tests pass and CRAP scores have improved.
```

### Recommended Usage

1. **Create the branch** manually first (recommended on Windows):
   ```powershell
   git checkout master
   git pull
   git checkout -b feature/crap-analysis-coverage
   ```

---

#### **Prompt 6 – Final Tests + Polish** ✅ Completed

Markdown

```
You are working on the dryjs project.

Switch to **new branch** `feature/final-tests-polish`.

- Add comprehensive end-to-end test in `test/e2e.test.mjs`
- Run full test suite with coverage
- Polish README.md with usage examples
- Final fixes

Commit when everything passes, then provide instructions to merge to master
```

---

#### **Prompt 5 – CLI Orchestration** ✅ Completed

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

---

#### **Prompt 4 – Comparator + Reporter** ✅ Completed

Markdown

```
You are working on the dryjs project. Read guardrails first.

Switch to **new branch** `feature/comparator-reporter`.

Implement `src/comparator.mjs` and `src/reporter.mjs`.

Add relevant tests.

Run `npm test` until passing.

Commit: "feat: comparator and reporter"
```

---

#### **Prompt 3 – Fingerprinter** ✅ Completed

Markdown

```
You are working on the dryjs project. Read guardrails first.

Switch to **new branch** `feature/fingerprinter`.

Implement `src/fingerprinter.mjs`.

Update tests to verify identical fingerprints for equivalent structures.

Run `npm test` → iterate until passing.

Commit: "feat: fingerprinter + tests"
```

---

#### **Prompt 2 – Normaliser** ✅ Completed

Markdown

```
You are working on the dryjs project. Read all guardrail files first.

Switch to **new branch** `feature/normaliser`.

Implement `src/normaliser.mjs` (normalise + serialise) following the exact rules.

Create strong tests in `test/normaliser.test.mjs` proving renamed functions produce identical output.

Run `npm test` and iterate until passing.

Commit: "feat: deterministic normaliser + tests"
```

---

#### **Prompt 1 – Scanner + Parser** ✅ Completed

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
