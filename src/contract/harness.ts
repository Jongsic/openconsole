import { describe, expect } from "vitest";
import { useSettings } from "@/store/settings";

// Minimal ambient `process.env` so the harness typechecks without adding node
// types to the whole app build (which would shadow the DOM lib's Uint8Array and
// break unrelated app code). These tests only ever run under node via vitest.
declare const process: { env: Record<string, string | undefined> };

/**
 * Live contract/smoke harness (Tier 2).
 *
 * Philosophy: these tests run against a REAL backend (LocalStack / Floci / moto /
 * MinIO / AWS) and verify only that OUR code survives whatever the backend
 * returns. A backend returning "not implemented", a different shape, or an error
 * is fine — that is the backend's business. A test fails only when:
 *   - the call RESOLVES but the result does NOT parse to our loose shape (our
 *     `.map`/transform produced the wrong thing), or
 *   - the call REJECTS with something that is NOT a backend/AWS SDK error (e.g. a
 *     TypeError from our parsing crashing on an unexpected field).
 *
 * When no endpoint is configured the whole suite is skipped (see `contractDescribe`),
 * so `pnpm test:contract` passes cleanly with no backend.
 */

/** True when the live contract suite should run. */
export const CONTRACT_ENABLED = Boolean(process.env.OC_ENDPOINT) || process.env.OC_CONTRACT === "1";

/** Use in place of `describe` so suites self-skip when no backend is configured. */
export const contractDescribe = CONTRACT_ENABLED ? describe : describe.skip;

/**
 * Point the api at the configured backend by writing the zustand settings store
 * (which `get*Client()` reads). Call once in a `beforeAll`.
 */
export function configureBackendFromEnv(): void {
  useSettings.getState().setSettings({
    endpoint: process.env.OC_ENDPOINT ?? "http://localhost:4566",
    region: process.env.OC_REGION ?? "us-east-1",
    accessKeyId: process.env.OC_ACCESS_KEY_ID ?? "test",
    secretAccessKey: process.env.OC_SECRET_ACCESS_KEY ?? "test",
    forcePathStyle: true,
    websiteHost: "",
  });
}

/**
 * Is `e` a backend/AWS SDK error (as opposed to a bug in our code)? True when it
 * carries SDK `$metadata`, or its name looks like an SDK exception, or it's a
 * fetch/network failure (the endpoint being unreachable is the backend's fault,
 * not ours).
 */
export function isAwsSdkError(e: unknown): boolean {
  if (e == null || typeof e !== "object") return false;
  const err = e as { $metadata?: unknown; name?: unknown; message?: unknown };
  if (err.$metadata != null) return true;
  const name = typeof err.name === "string" ? err.name : "";
  if (/Exception$/.test(name)) return true;
  // Known SDK / connectivity error names.
  if (
    [
      "TimeoutError",
      "ThrottlingException",
      "ServiceUnavailable",
      "NetworkingError",
      "AbortError",
    ].includes(name)
  ) {
    return true;
  }
  // The endpoint being down surfaces as a fetch TypeError — not our bug.
  const message = typeof err.message === "string" ? err.message : "";
  if (name === "TypeError" && /fetch failed|ECONNREFUSED|getaddrinfo/i.test(message)) return true;
  if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(message)) return true;
  return false;
}

/**
 * Run a contract assertion for one api read function:
 *  - resolve → must parse to our shape (else our transform is wrong = a real bug);
 *  - reject  → must be a backend/AWS error (else our parsing crashed = a real bug).
 */
export async function assertContract<T>(
  fn: () => Promise<T>,
  schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } },
): Promise<void> {
  try {
    const result = await fn();
    const parsed = schema.safeParse(result);
    if (!parsed.success) {
      throw new Error(
        `Result did not match our shape (our transform produced an unexpected value): ${JSON.stringify(parsed.error)}`,
      );
    }
    expect(parsed.success).toBe(true);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Result did not match our shape")) throw e;
    // Any rejection must be a backend/AWS error, never an our-side crash.
    expect(isAwsSdkError(e)).toBe(true);
  }
}
