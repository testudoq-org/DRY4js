# dryjs Development Workflow

## Environment
- Windows 11, VS Code, Node.js 20+, PowerShell

## Branching Strategy
- `master` – stable, tested code only
- `feature/<name>` – one feature per branch, merged via PR or fast-forward

## Workflow Per Feature
1. Switch to or create the feature branch
2. Implement the feature in `src/*.mjs`
3. Write tests in `test/*.test.mjs`
4. Run `npm test` and iterate until all tests pass
5. Commit with a conventional commit message: `feat:`, `fix:`, `chore:`, `test:`
6. Only merge to master when tests are green

## Commands
```powershell
npm test              # run all tests with Vitest
npm run test:coverage # run tests + coverage report
npm run lint          # (future) ESLint
```

## Commit Message Convention
- `feat:` – new feature
- `fix:` – bug fix
- `chore:` – tooling, scaffolding, config
- `test:` – tests only
- `refactor:` – code change with no behaviour change
