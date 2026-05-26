
# dryjs Prompt Addendum

## Why This Design

- Normalisation must be 100% deterministic → fixed child order is mandatory.
- Structural (not textual) comparison is the core value.
- Pure functions + clear module boundaries for reliability.
- One bad file must never crash the whole scan.
