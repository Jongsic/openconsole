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

## Guidelines

- **Code style** is enforced by [Biome](https://biomejs.dev). Run `pnpm format` before committing.
- Keep the app **browser-only** — no server-side runtime should be introduced. S3 access goes
  directly through `@aws-sdk/client-s3` in the browser.
- **User-facing strings** must be added to both `src/i18n/en.json` and `src/i18n/ko.json`.
- Add or update tests for non-trivial logic where practical.
- Keep pull requests focused; describe what changed and why.

## Reporting bugs / requesting features

Use the issue templates. For security issues, see [SECURITY.md](SECURITY.md) — do not open a
public issue.

## License

By contributing, you agree that your contributions are released into the public domain under
[The Unlicense](LICENSE).
