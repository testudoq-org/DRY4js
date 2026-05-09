# dryjs Prompt Addendum – Why We Built It This Way

## Core Philosophy

This tool is a **structural** (not textual) duplicate detector. The goal is to find code that has the **same shape** even if names, literals, and minor details differ. It is using ideas from https://github.com/unclebob/dry4clj and porting to es6 javascript.

## Key Design Decisions & Reasoning

### 1. Parser Choice (@babel/parser)

- Chosen because it reliably supports JSX + TypeScript + modern syntax in one parser.
- Acorn would require multiple plugins and still have edge cases.

### 2. Normalisation Strategy

- We convert the Babel AST into a minimal `{ type, children }` tree because it removes noise while keeping structure.
- **Fixed child traversal order** is critical for determinism. Without it, object property enumeration order in JavaScript can produce different outputs for equivalent code.

### 3. Fingerprinting Approach

- Sub-tree serialisation (max depth 4) + Set of strings gives good balance between sensitivity and performance.
- We ignore very small sub-trees (< 3 nodes) to reduce noise.

### 4. Brute-force Comparison (v1)

- For the expected use case (< 1000 top-level forms), O(n²) is fast enough and perfectly accurate.
- More advanced techniques (MinHash, etc.) add complexity and risk of false negatives.

### 5. Pure Functions + Module Separation

- Each module has a single clear responsibility.
- This makes testing easier and reduces bugs in a tool where correctness is paramount.

### 6. Error Handling Philosophy

- Never let one bad file crash the entire scan.
- Log warnings and continue — robustness matters more than perfection.

## What "Good" Looks Like

- Normaliser must return **identical** output for renamed but structurally equivalent functions.
- Fingerprints must be deterministic across runs and machines.
- CLI must feel fast and professional.

---

**When using any prompt for this project, always start with:**

> "You are working on the dryjs project. Read `.github/copilot-instructions.md`, `ARCHITECTURE.md`, and `PROMPT-ADDENDUM.md` first. Confirm you understand the fixed child traversal order and normalisation rules before writing code."
>
