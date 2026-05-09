**✅ Here is the complete, ready-to-use prompt set** for building `dryjs` from scratch with strong guardrails.

---

### **Master Prompt 0: Project Initialization + GitHub Guardrails**

*(Run this first — creates the repo skeleton and protection files)*

```md
You are building `dryjs` — a structural duplicate code detector for JavaScript/TypeScript.

**Environment:**
- Windows 11 + VS Code + GitHub Copilot + RooCode
- Pure ES6 modules (`.mjs` files only)
- Node.js 20+
- Use PowerShell for any terminal commands

**First, create the full project scaffolding:**

1. Initialize a clean Git repository (assume we are starting fresh).
2. Create this exact folder structure:
```

dryjs/
├── .github/
│   └── copilot-instructions.md
├── src/
│   ├── cli.mjs
│   ├── scanner.mjs
│   ├── parser.mjs
│   ├── normaliser.mjs
│   ├── fingerprinter.mjs
│   ├── comparator.mjs
│   ├── reporter.mjs
│   └── utils.mjs
├── test/
├── ARCHITECTURE.md
├── README.md
├── package.json
├── .gitignore
└── .dryjsignore

```

3. Create **all guardrail files** with the exact content below (do not shorten them):

**`.github/copilot-instructions.md`** — (paste the full content from my previous message — the one starting with `# dryjs – AI Agent / Copilot Instructions`)

**`ARCHITECTURE.md`** — (paste the full content with the Mermaid diagram and table)

**`package.json`** with:
- name: "dryjs"
- version: "0.1.0"
- type: "module"
- bin: { "dryjs": "src/cli.mjs" }
- dependencies: `@babel/parser`, `@babel/traverse`, `commander`, `fast-glob`, `picocolors`, `ora`
- devDependencies: `vitest`
- scripts: `"test": "vitest"`

**`.gitignore`** — standard Node + editor files.

**`README.md`** — basic usage, installation, and note about guardrails.

After creating everything, make the first commit on `master` with message "Initial project scaffold + guardrails".

Then create and switch to a new branch: `feature/scaffold-complete`

Confirm by listing the files created.
```

---

### **Prompt 1: Scanner + Parser**

*(New branch)*

```md
You are working on the dryjs project.

Read `.github/copilot-instructions.md` and `ARCHITECTURE.md` first. Confirm you have read them by summarising the parser choice and the exact child traversal order.

Now implement on a **new branch** called `feature/scanner-parser`:

- `src/scanner.mjs`
- `src/parser.mjs`
- Update `src/utils.mjs` with any shared helpers needed (e.g. node counting)

Follow all rules in the copilot instructions exactly.

After implementation, run `npm test` (even if tests don't exist yet) and ensure the code lints cleanly and exports correctly.

Commit with message: "feat: implement scanner and parser with Babel"
```

---

### **Prompt 2: Normaliser (Most Critical)**

*(New branch)*

```md
You are working on the dryjs project.

Read `.github/copilot-instructions.md` and `ARCHITECTURE.md` first.

Switch to a **new branch** called `feature/normaliser`.

Implement `src/normaliser.mjs` following the **exact** normalisation rules and fixed child traversal order defined in the copilot instructions.

Also implement `serialise(normNode, maxDepth = 4)`.

This module must be 100% deterministic.

After writing, create a test in `test/normaliser.test.mjs` that proves two functions differing only in variable names and literal values produce **identical** normalised output.

Commit with message: "feat: implement deterministic normaliser"
```

---

### **Prompt 3: Fingerprinter**

*(New branch)*

```md
You are working on the dryjs project.

Read guardrails first.

Switch to a **new branch** called `feature/fingerprinter`.

Implement `src/fingerprinter.mjs`:
- `fingerprint(normNode)` → `Set<string>`
- Only sub-trees with ≥ 3 nodes
- Max depth 4

Add `getNodeCount()` to `utils.mjs` if needed.

Update the test suite to verify identical structures produce identical fingerprint sets.

Commit with message: "feat: implement fingerprinter"
```

---

### **Prompt 4: Comparator + Reporter**

*(New branch)*

```md
You are working on the dryjs project.

Switch to a **new branch** called `feature/comparator-reporter`.

Implement:
- `src/comparator.mjs` (Jaccard + pairwise compare)
- `src/reporter.mjs`

Follow exact output formats specified earlier.

Commit with message: "feat: implement comparator and reporter"
```

---

### **Prompt 5: CLI Orchestration + Polish**

*(New branch)*

```md
You are working on the dryjs project.

Switch to a **new branch** called `feature/cli-orchestration`.

Implement `src/cli.mjs` using `commander`.

Orchestrate the full pipeline:
scan → parse → normalise → fingerprint → compare → report

Add progress spinner with `ora`.

Support all CLI flags:
--threshold, --min-lines, --min-nodes, --format, --ignore

Make `dryjs` command globally runnable via npm link or npx.

Commit with message: "feat: complete CLI orchestration"
```

---

### **Prompt 6: Tests + Final Polish**

*(New branch)*

```md
You are working on the dryjs project.

Switch to a **new branch** called `feature/tests-polish`.

Write comprehensive Vitest tests for all modules.

Ensure end-to-end test works with temporary files containing known similar code.

Update README.md with full usage instructions and examples.

Final commit on this branch, then merge to master.
```

---

### **Workflow Instructions for You (Windows 11 + VS Code)**

1. Start a new VS Code window in the project folder.
2. Open Copilot Chat or RooCode.
3. Paste **one prompt at a time**.
4. After each major prompt, run in PowerShell:
   ```powershell
   git status
   npm test
   npm run build   # (if you add build step later)
   ```
5. Always start each new prompt with:
   > "You are working on the dryjs project. Read `.github/copilot-instructions.md` and `ARCHITECTURE.md` first."
   >

Would you like me to also provide:

- A **PowerShell helper script** to automate branch creation + prompt reminders?
- A `ROADMAP.md`?
- The full expanded text of the guardrail files again in one block?

Just say the word and I’ll give you the next piece. Ready when you are.
