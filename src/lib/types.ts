import { z } from "zod";

/* ── Connection settings ── */

export const settingsSchema = z.object({
  /** Empty = use the real AWS default endpoint */
  endpoint: z.string(),
  region: z.string().min(1),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  forcePathStyle: z.boolean(),
  /** Static website hosting host (with port) */
  websiteHost: z.string(),
});

export type ConnectionSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: ConnectionSettings = {
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  accessKeyId: "test",
  secretAccessKey: "test",
  forcePathStyle: true,
  websiteHost: "s3-website.localhost.localstack.cloud:4566",
};

export type BackendKind = "localstack" | "minio" | "aws" | "unknown" | "none";

/* ── S3 domain types ── */

export const bucketNameSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/);

export type BucketSummary = { name: string; creationDate: string | null };

export type ObjectSummary = {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  storageClass: string | null;
};

export type FolderSummary = { prefix: string; name: string };

export type ObjectDetails = {
  key: string;
  contentType: string | null;
  contentLength: number;
  lastModified: string | null;
  etag: string | null;
  /** User-defined metadata (x-amz-meta-*) */
  metadata: Record<string, string>;
  tags: Tag[];
  /** Direct object URL (opens only if public) */
  url: string;
};

export type ListObjectsResponse = {
  bucket: string;
  prefix: string;
  folders: FolderSummary[];
  objects: ObjectSummary[];
};

/* ── Bucket properties ── */

export type VersioningStatus = "Enabled" | "Suspended" | "Disabled";
export type Tag = { key: string; value: string };

export type WebsiteConfig = {
  enabled: boolean;
  indexDocument: string;
  errorDocument: string;
  endpoint: string | null;
};

export type BucketProperties = {
  arn: string;
  versioning: { status: VersioningStatus };
  tagging: { tags: Tag[] };
  encryption: { enabled: boolean; algorithm: "AES256" | "aws:kms" | null };
  cors: { json: string | null };
  policy: { document: string | null };
  website: WebsiteConfig;
};

export type UpdatePropertyInput =
  | { section: "versioning"; value: { status: "Enabled" | "Suspended" } }
  | { section: "tagging"; value: { tags: Tag[] } }
  | { section: "encryption"; value: { enabled: boolean; algorithm?: "AES256" | "aws:kms" | null } }
  | { section: "cors"; value: { json: string | null } }
  | { section: "policy"; value: { document: string | null } }
  | {
      section: "website";
      value: { enabled: boolean; indexDocument?: string; errorDocument?: string };
    };
