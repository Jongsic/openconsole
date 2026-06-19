import { S3Client } from "@aws-sdk/client-s3";
import { useSettings } from "@/store/settings";
import type { ConnectionSettings } from "./types";

/** Build an S3 client from settings. An empty endpoint uses the real AWS default. */
export function clientFromSettings(s: ConnectionSettings): S3Client {
  return new S3Client({
    ...(s.endpoint.trim() ? { endpoint: s.endpoint.trim() } : {}),
    region: s.region || "us-east-1",
    forcePathStyle: s.forcePathStyle,
    credentials: {
      accessKeyId: s.accessKeyId || "test",
      secretAccessKey: s.secretAccessKey || "test",
    },
    // Recent SDKs add a flexible-checksum header (x-amz-sdk-checksum-algorithm) by default, which
    // many backends don't allow in CORS, breaking preflight. Send it only when required.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

let cached: { key: string; client: S3Client } | null = null;

/** Client based on the current settings (recreated when settings change) */
export function getClient(): S3Client {
  const s = useSettings.getState().settings;
  const key = JSON.stringify(s);
  if (cached?.key === key) return cached.client;
  const client = clientFromSettings(s);
  cached = { key, client };
  return client;
}
