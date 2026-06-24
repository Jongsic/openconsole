# Contributing

Thanks for your interest in improving OpenConsole! Contributions of any size are welcome.

## Development setup

Requires Node (see `.node-version`) and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:3939
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Typecheck + production build to `dist/` |
| `pnpm preview` | Serve the built `dist/` |
| `pnpm typecheck` | TypeScript check (no emit) |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm lint` | Lint & format check (Biome) |
| `pnpm format` | Auto-format (Biome) |

## Before opening a pull request

Please make sure these pass locally — CI runs the same checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Testing

OpenConsole has two test tiers:

- **Unit (Tier 1)** — `pnpm test`. Runs offline in jsdom with the AWS SDK mocked
  (`aws-sdk-client-mock`); render components via the helper in `src/test/render.tsx`. Tests are
  colocated (`foo.ts` → `foo.test.ts`). This tier runs on every PR in CI.
- **Contract (Tier 2)** — `pnpm test:contract`. Runs `src/contract/*.contract.test.ts` against a
  **real** backend pointed to by `OC_ENDPOINT`, verifying our SDK usage survives what the backend
  actually returns. The suite self-skips when no endpoint is set, so it passes cleanly offline. CI
  runs it across backends (LocalStack, Floci) via the **Contract** workflow, starting them from
  `examples/local-backends`. A backend returning "not implemented" or an error is fine — a contract
  test fails only when *our* code mis-parses or crashes.

  To run it locally against a backend:

  ```bash
  (cd examples/local-backends && docker compose --profile localstack up -d)
  OC_ENDPOINT=http://localhost:4566 pnpm test:contract
  ```

### Testing policy

- PRs that introduce new behavior or fix a bug should add or update tests covering it (a regression
  test for fixes, where realistic).
- PRs that change SDK calls, parsing/transform logic, or backend detection should extend the
  contract tier when the behavior is only observable against a real backend.
- Docs, formatting, comments, and low-risk refactors may not need new tests — but the existing
  suite (`pnpm test`, `pnpm typecheck`, `pnpm lint`) must still pass.
- If you skip tests, say why in the PR description.

## Guidelines

- **Code style** is enforced by [Biome](https://biomejs.dev). Run `pnpm format` before committing.
- Keep the app **browser-only** — no server-side runtime should be introduced. S3 access goes
  directly through `@aws-sdk/client-s3` in the browser.
- **User-facing strings** must be added to both `src/i18n/en.json` and `src/i18n/ko.json`.
- Add or update tests for non-trivial logic where practical.
- Keep pull requests focused; describe what changed and why.
- Do not include `Co-Authored-By` trailers for AI tools in commit messages. Attribution should be
  limited to human contributors.

## Reporting bugs / requesting features

Use the issue templates. For security issues, see [SECURITY.md](SECURITY.md) — do not open a
public issue.

## License

By contributing, you agree that your contributions are released into the public domain under
[The Unlicense](LICENSE).
