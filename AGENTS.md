# AGENTS.md

Agent instructions for OpenConsole, following the [AGENTS.md standard](https://agents.md/).
If your coding agent expects a different filename, symlink it instead of copying:

```bash
ln -s AGENTS.md CLAUDE.md
```

## Project Overview

OpenConsole is a **browser-only** web console for AWS-compatible backends — LocalStack,
Floci, moto, MinIO, or real AWS. It is a static single-page app (React + Vite); there is
**no backend of our own**. The browser talks to the user's endpoint directly with the AWS
SDK for JavaScript v3, and connection settings live in `localStorage`.

## First Principles

- **No server, ever.** Everything runs in the browser. Never add a component that proxies
  requests, phones home, or sends telemetry. Endpoint and credentials must never leave the
  browser. This is a hard product promise (see README).
- **The backend is untrusted and varied.** Code must tolerate LocalStack/Floci/moto/MinIO/AWS
  differences. Feature-gate by detected backend rather than assuming a capability exists.
- **CORS is a first-class concern.** The app calls the backend cross-origin from a static
  page, so SDK behavior that breaks CORS preflight is a real bug, not a theoretical one.

## Stack

- React 18 + TypeScript, Vite (dev server on port **3939**)
- Routing: `react-router-dom` (`BrowserRouter`)
- Server state: `@tanstack/react-query`; client state: `zustand`
- Validation: `zod`; i18n: `i18next` / `react-i18next` (English + Korean)
- Styling: Tailwind CSS; icons: `lucide-react`; zip: `fflate`
- AWS access: `@aws-sdk/client-*` v3 (S3, EC2, IAM, Lambda, RDS, ElastiCache, ELBv2, Auto Scaling)
- Tooling: **Biome** (lint + format), **Vitest** (tests). Node pinned in `.node-version` (24.x).

## Package Layout

Path alias `@` → `src/` (configured in `vite.config.ts` and the vitest configs).

| Path | Purpose |
|------|---------|
| `src/lib/` | Core logic. Per service: `<svc>-client.ts` (SDK client factory from settings) + `<svc>-api.ts` (operation wrappers). Plus `detect.ts`/`backends.ts` (backend detection), `aws-error.ts`, `sections.ts`, `types.ts`. Unit tests colocated as `*.test.ts`. |
| `src/pages/` | One feature page per resource (`ec2.tsx`, `iam-roles.tsx`, …), tests colocated as `*.test.tsx`. |
| `src/components/` | App shell + dialogs (top nav, section layout, connection dialog, error boundary, providers). |
| `src/components/kit/` | Design-system primitives (`resource-table`, `detail-header`, `status-badge`, `section`, …). Reuse these instead of bespoke markup. Re-exported from `kit/index.ts`. |
| `src/store/` | `settings.ts` — the zustand store for connection settings (persisted to `localStorage`). |
| `src/config/` | `backends.json` — backend detection metadata. |
| `src/contract/` | Live contract/smoke tests (`*.contract.test.ts`) + `harness.ts`. |
| `src/test/` | Test helpers: `render.tsx` (RTL wrapper with providers) and `setup.ts`. |
| `src/i18n/` | `en.json` / `ko.json` translation catalogs. |

## Conventions

- **Formatting/lint: Biome.** 2-space indent, line width 100, **double quotes**. Run `pnpm lint`
  and `pnpm format`; do not hand-format against these rules.
- **Imports** use the `@/` alias for `src` (e.g. `import { useSettings } from "@/store/settings"`).
- **Client factories** build the SDK client from `ConnectionSettings`: empty endpoint → real AWS;
  default region `us-east-1`; default creds `test`/`test`. See `src/lib/s3-client.ts` as the
  canonical pattern, and cache the client keyed on serialized settings.
- **CORS-safety:** SDK options that add preflight-breaking headers must be neutralized. Example
  already in place: S3 clients set `requestChecksumCalculation`/`responseChecksumValidation` to
  `"WHEN_REQUIRED"` because the default flexible-checksum header fails CORS on many backends.
  Apply the same caution to any new client.
- **User-facing strings** go through i18n (`en.json` + `ko.json`) — never hardcode English in JSX.

## Build & Run

```bash
pnpm install
pnpm dev          # http://localhost:3939
pnpm build        # tsc --noEmit + vite build → dist/
pnpm preview      # serve the built dist/
```

| Command | Description |
|---------|-------------|
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest, jsdom) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:contract` | Live contract tier — `*.contract.test.ts` against a real backend |
| `pnpm lint` | Biome check |
| `pnpm format` | Biome format (writes) |

## Testing Rules

- **Unit tests are colocated** (`foo.ts` → `foo.test.ts`, `foo.tsx` → `foo.test.tsx`) and run
  offline in jsdom. Mock the AWS SDK with `aws-sdk-client-mock`; render components via the
  helper in `src/test/render.tsx` (it wires up the providers).
- **Contract tests** (`src/contract/*.contract.test.ts`) hit a real backend and
  `describe.skip` themselves when no endpoint is configured (see `harness.ts`), so the default
  `pnpm test:contract` run passes cleanly with no backend. Use them to verify real SDK wire
  behavior, not in the offline unit run.
- New behavior should come with tests; `pnpm test`, `pnpm typecheck`, and `pnpm lint` must pass.

## Adding a Service / Resource Page

1. `src/lib/<svc>-client.ts` — client factory from settings (mirror `s3-client.ts`, keep it
   CORS-safe).
2. `src/lib/<svc>-api.ts` — typed operation wrappers + `<svc>-api.test.ts`.
3. `src/pages/<resource>.tsx` — the page, built from `components/kit/` primitives + `<resource>.test.tsx`.
4. Register the route in `src/App.tsx` and the nav entry in `src/lib/sections.ts`.
5. Add translations to `src/i18n/en.json` and `ko.json`.
6. If the resource is backend-gated, wire detection through `detect.ts`/`backends.ts`.
7. Optionally add a `src/contract/<svc>.contract.test.ts` for live verification.

## Commits & PRs

- Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `ci:`,
  `docs:`, `chore:`, …) — the history already uses them.
- See `CONTRIBUTING.md` for the development setup and the script reference.
