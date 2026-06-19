import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { clientFromSettings } from "./s3-client";
import type { BackendKind, ConnectionSettings } from "./types";

/** Connection failure classification */
export type DetectFailure = "cors" | "credentials" | "other";

export type DetectResult = {
  backend: BackendKind;
  /** Whether S3 ListBuckets actually worked */
  reachable: boolean;
  /** Failure cause (when not reachable) */
  failure?: DetectFailure;
  /** Human-readable detail (error name/message) */
  detail?: string;
};

function base(endpoint: string): string {
  return endpoint.trim().replace(/\/$/, "");
}

async function isLocalStack(ep: string): Promise<boolean> {
  try {
    const r = await fetch(`${ep}/_localstack/health`, { method: "GET" });
    if (!r.ok) return false;
    const j = await r.json();
    return !!(j && typeof j === "object" && "services" in j);
  } catch {
    return false;
  }
}

async function isMinio(ep: string): Promise<boolean> {
  try {
    const r = await fetch(`${ep}/minio/health/live`, { method: "GET" });
    return r.ok;
  } catch {
    return false;
  }
}

const AUTH_ERROR_RE =
  /InvalidAccessKeyId|SignatureDoesNotMatch|AccessDenied|InvalidSecurity|InvalidClientTokenId|UnrecognizedClient|TokenRefreshRequired|MissingAuthentication/i;

type ProbeResult = { ok: true } | { ok: false; kind: DetectFailure; detail: string };

/**
 * Classify an S3 error by cause.
 *  - HTTP status (esp. 401/403) or an auth-related error name -> credentials/permission
 *  - has a status code but not auth-related -> other
 *  - no status code -> the browser blocked the response (CORS) or the network is down
 */
export function classifyFailure(e: unknown): { kind: DetectFailure; detail: string } {
  const err = e as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const status = err?.$metadata?.httpStatusCode;
  const name = err?.name ?? "";
  const detail = name && err?.message ? `${name}: ${err.message}` : name || err?.message || "error";

  if (status || AUTH_ERROR_RE.test(name)) {
    if (status === 403 || status === 401 || AUTH_ERROR_RE.test(name)) {
      return { kind: "credentials", detail };
    }
    return { kind: "other", detail };
  }
  return { kind: "cors", detail };
}

/** Actually call ListBuckets to test connectivity and classify any failure. */
async function probeListBuckets(s: ConnectionSettings): Promise<ProbeResult> {
  try {
    await clientFromSettings(s).send(new ListBucketsCommand({}));
    return { ok: true };
  } catch (e) {
    return { ok: false, ...classifyFailure(e) };
  }
}

/** Guess the backend kind + run a connection test (with failure classification). */
export async function detectBackend(s: ConnectionSettings): Promise<DetectResult> {
  const ep = base(s.endpoint);

  let backend: BackendKind;
  if (!ep || /amazonaws\.com/i.test(ep)) backend = "aws";
  else if (await isLocalStack(ep)) backend = "localstack";
  else if (await isMinio(ep)) backend = "minio";
  else backend = "unknown";

  const probe = await probeListBuckets(s);
  if (probe.ok) {
    return { backend, reachable: true };
  }
  // Unknown kind and not reachable -> none
  return {
    backend: backend === "unknown" ? "none" : backend,
    reachable: false,
    failure: probe.kind,
    detail: probe.detail,
  };
}

/** Per-backend feature gating: whether non-S3 service tabs are enabled */
export function isFullFeatured(backend: BackendKind): boolean {
  return backend === "localstack";
}

/* ── Candidate discovery ── */

export type Candidate = {
  backend: BackendKind;
  endpoint: string;
  /** Defaults to fill into the form when selected */
  defaults: Pick<
    ConnectionSettings,
    "endpoint" | "region" | "forcePathStyle" | "accessKeyId" | "secretAccessKey" | "websiteHost"
  >;
};

const CANDIDATE_DEFS: Array<{
  backend: BackendKind;
  endpoint: string;
  probe: string;
  defaults: Candidate["defaults"];
}> = [
  {
    backend: "localstack",
    endpoint: "http://localhost:4566",
    probe: "/_localstack/health",
    defaults: {
      endpoint: "http://localhost:4566",
      region: "us-east-1",
      forcePathStyle: true,
      accessKeyId: "test",
      secretAccessKey: "test",
      websiteHost: "s3-website.localhost.localstack.cloud:4566",
    },
  },
  {
    backend: "minio",
    endpoint: "http://localhost:9000",
    probe: "/minio/health/live",
    defaults: {
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      forcePathStyle: true,
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
      websiteHost: "",
    },
  },
];

/**
 * Probe well-known local endpoints and collect the ones that respond.
 * (Checks only health paths without credentials — finds CORS-allowed backends only.)
 */
export async function discoverCandidates(): Promise<Candidate[]> {
  const found: Candidate[] = [];
  for (const def of CANDIDATE_DEFS) {
    try {
      const r = await fetch(def.endpoint + def.probe);
      if (!r.ok) continue;
      if (def.backend === "localstack") {
        const j = await r.json().catch(() => null);
        if (!j || typeof j !== "object" || !("services" in j)) continue;
      }
      found.push({ backend: def.backend, endpoint: def.endpoint, defaults: def.defaults });
    } catch {
      /* unreachable / CORS-blocked -> not a candidate */
    }
  }
  return found;
}
