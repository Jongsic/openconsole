import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteBucketCorsCommand,
  DeleteBucketEncryptionCommand,
  DeleteBucketPolicyCommand,
  DeleteBucketTaggingCommand,
  DeleteBucketWebsiteCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetBucketCorsCommand,
  GetBucketEncryptionCommand,
  GetBucketPolicyCommand,
  GetBucketTaggingCommand,
  GetBucketVersioningCommand,
  GetBucketWebsiteCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutBucketEncryptionCommand,
  PutBucketPolicyCommand,
  PutBucketTaggingCommand,
  PutBucketVersioningCommand,
  PutBucketWebsiteCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { useSettings } from "@/store/settings";
import { getClient } from "./s3-client";
import type {
  BucketProperties,
  BucketSummary,
  ListObjectsResponse,
  ObjectDetails,
  UpdatePropertyInput,
} from "./types";

/** Direct path-style object URL */
function objectUrl(bucket: string, key: string): string {
  const s = useSettings.getState().settings;
  const base = (s.endpoint.trim() || `https://s3.${s.region || "us-east-1"}.amazonaws.com`).replace(
    /\/$/,
    "",
  );
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/${bucket}/${encodedKey}`;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const api = {
  listBuckets: async (): Promise<BucketSummary[]> => {
    const out = await getClient().send(new ListBucketsCommand({}));
    return (out.Buckets ?? []).map((b) => ({
      name: b.Name ?? "",
      creationDate: b.CreationDate ? b.CreationDate.toISOString() : null,
    }));
  },

  createBucket: async (name: string): Promise<void> => {
    await getClient().send(new CreateBucketCommand({ Bucket: name }));
  },

  deleteBucket: async (bucket: string, force: boolean): Promise<void> => {
    const s3 = getClient();
    if (force) {
      let token: string | undefined;
      do {
        const listed = await s3.send(
          new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
        );
        const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key as string }));
        if (keys.length > 0) {
          await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
        }
        token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (token);
    }
    await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
  },

  listObjects: async (bucket: string, prefix: string): Promise<ListObjectsResponse> => {
    const s3 = getClient();
    const folders: ListObjectsResponse["folders"] = [];
    const objects: ListObjectsResponse["objects"] = [];
    let token: string | undefined;

    do {
      const out = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: "/",
          ContinuationToken: token,
        }),
      );
      for (const cp of out.CommonPrefixes ?? []) {
        const full = cp.Prefix ?? "";
        if (!full) continue;
        folders.push({ prefix: full, name: full.slice(prefix.length).replace(/\/$/, "") });
      }
      for (const o of out.Contents ?? []) {
        const key = o.Key ?? "";
        if (key === prefix) continue;
        objects.push({
          key,
          name: key.slice(prefix.length),
          size: o.Size ?? 0,
          lastModified: o.LastModified ? o.LastModified.toISOString() : null,
          storageClass: o.StorageClass ?? null,
        });
      }
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);

    return { bucket, prefix, folders, objects };
  },

  saveObject: async (
    bucket: string,
    key: string,
    content: string,
    contentType?: string,
  ): Promise<void> => {
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: contentType ?? "text/plain; charset=utf-8",
      }),
    );
  },

  deleteObject: async (bucket: string, key: string): Promise<void> => {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  },

  uploadFiles: async (bucket: string, prefix: string, files: FileList | File[]): Promise<void> => {
    const s3 = getClient();
    for (const file of Array.from(files)) {
      const buf = new Uint8Array(await file.arrayBuffer());
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `${prefix}${file.name}`,
          Body: buf,
          ContentType: file.type || "application/octet-stream",
        }),
      );
    }
  },

  fetchText: async (bucket: string, key: string): Promise<string> => {
    const out = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return (await out.Body?.transformToString()) ?? "";
  },

  /** Create a blob URL for preview (caller must revokeObjectURL) */
  objectBlobUrl: async (bucket: string, key: string): Promise<string> => {
    const out = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await out.Body?.transformToByteArray();
    const blob = new Blob([bytes ?? new Uint8Array()], {
      type: out.ContentType ?? "application/octet-stream",
    });
    return URL.createObjectURL(blob);
  },

  getObjectDetails: async (bucket: string, key: string): Promise<ObjectDetails> => {
    const s3 = getClient();
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const tags = await safe(
      async () => {
        const out = await s3.send(new GetObjectTaggingCommand({ Bucket: bucket, Key: key }));
        return (out.TagSet ?? []).map((t) => ({ key: t.Key ?? "", value: t.Value ?? "" }));
      },
      [] as { key: string; value: string }[],
    );

    return {
      key,
      contentType: head.ContentType ?? null,
      contentLength: head.ContentLength ?? 0,
      lastModified: head.LastModified ? head.LastModified.toISOString() : null,
      etag: head.ETag ?? null,
      metadata: head.Metadata ?? {},
      tags,
      url: objectUrl(bucket, key),
    };
  },

  downloadObject: async (bucket: string, key: string): Promise<void> => {
    const out = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await out.Body?.transformToByteArray();
    const blob = new Blob([bytes ?? new Uint8Array()], {
      type: out.ContentType ?? "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = key.split("/").pop() || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  getProperties: async (bucket: string): Promise<BucketProperties> => {
    const s3 = getClient();
    const websiteHost = useSettings.getState().settings.websiteHost;

    const [versioning, tagging, encryption, cors, policy, website] = await Promise.all([
      safe<BucketProperties["versioning"]>(
        async () => {
          const out = await s3.send(new GetBucketVersioningCommand({ Bucket: bucket }));
          return { status: (out.Status as "Enabled" | "Suspended") ?? "Disabled" };
        },
        { status: "Disabled" },
      ),

      safe<BucketProperties["tagging"]>(
        async () => {
          const out = await s3.send(new GetBucketTaggingCommand({ Bucket: bucket }));
          return {
            tags: (out.TagSet ?? []).map((t) => ({ key: t.Key ?? "", value: t.Value ?? "" })),
          };
        },
        { tags: [] },
      ),

      safe<BucketProperties["encryption"]>(
        async () => {
          const out = await s3.send(new GetBucketEncryptionCommand({ Bucket: bucket }));
          const alg =
            out.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault
              ?.SSEAlgorithm ?? null;
          return { enabled: alg !== null, algorithm: (alg as "AES256" | "aws:kms" | null) ?? null };
        },
        { enabled: false, algorithm: null },
      ),

      safe<BucketProperties["cors"]>(
        async () => {
          const out = await s3.send(new GetBucketCorsCommand({ Bucket: bucket }));
          return { json: JSON.stringify(out.CORSRules ?? [], null, 2) };
        },
        { json: null },
      ),

      safe<BucketProperties["policy"]>(
        async () => {
          const out = await s3.send(new GetBucketPolicyCommand({ Bucket: bucket }));
          const doc = out.Policy ?? null;
          return { document: doc ? JSON.stringify(JSON.parse(doc), null, 2) : null };
        },
        { document: null },
      ),

      safe<BucketProperties["website"]>(
        async () => {
          const out = await s3.send(new GetBucketWebsiteCommand({ Bucket: bucket }));
          return {
            enabled: true,
            indexDocument: out.IndexDocument?.Suffix ?? "",
            errorDocument: out.ErrorDocument?.Key ?? "",
            endpoint: `http://${bucket}.${websiteHost}`,
          };
        },
        { enabled: false, indexDocument: "", errorDocument: "", endpoint: null },
      ),
    ]);

    return {
      arn: `arn:aws:s3:::${bucket}`,
      versioning,
      tagging,
      encryption,
      cors,
      policy,
      website,
    };
  },

  updateProperty: async (bucket: string, input: UpdatePropertyInput): Promise<void> => {
    const s3 = getClient();
    switch (input.section) {
      case "versioning":
        await s3.send(
          new PutBucketVersioningCommand({
            Bucket: bucket,
            VersioningConfiguration: { Status: input.value.status },
          }),
        );
        break;
      case "tagging":
        if (input.value.tags.length === 0) {
          await s3.send(new DeleteBucketTaggingCommand({ Bucket: bucket }));
        } else {
          await s3.send(
            new PutBucketTaggingCommand({
              Bucket: bucket,
              Tagging: { TagSet: input.value.tags.map((t) => ({ Key: t.key, Value: t.value })) },
            }),
          );
        }
        break;
      case "encryption":
        if (!input.value.enabled) {
          await s3.send(new DeleteBucketEncryptionCommand({ Bucket: bucket }));
        } else {
          await s3.send(
            new PutBucketEncryptionCommand({
              Bucket: bucket,
              ServerSideEncryptionConfiguration: {
                Rules: [
                  {
                    ApplyServerSideEncryptionByDefault: {
                      SSEAlgorithm: input.value.algorithm ?? "AES256",
                    },
                  },
                ],
              },
            }),
          );
        }
        break;
      case "cors": {
        const json = input.value.json?.trim();
        if (!json) {
          await s3.send(new DeleteBucketCorsCommand({ Bucket: bucket }));
        } else {
          const rules = JSON.parse(json);
          await s3.send(
            new PutBucketCorsCommand({
              Bucket: bucket,
              CORSConfiguration: { CORSRules: Array.isArray(rules) ? rules : rules.CORSRules },
            }),
          );
        }
        break;
      }
      case "policy": {
        const doc = input.value.document?.trim();
        if (!doc) {
          await s3.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
        } else {
          JSON.parse(doc);
          await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: doc }));
        }
        break;
      }
      case "website": {
        if (!input.value.enabled) {
          await s3.send(new DeleteBucketWebsiteCommand({ Bucket: bucket }));
        } else {
          const index = input.value.indexDocument?.trim() || "index.html";
          const error = input.value.errorDocument?.trim();
          await s3.send(
            new PutBucketWebsiteCommand({
              Bucket: bucket,
              WebsiteConfiguration: {
                IndexDocument: { Suffix: index },
                ...(error ? { ErrorDocument: { Key: error } } : {}),
              },
            }),
          );
        }
        break;
      }
    }
  },
};
