import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage for product photos.
 *
 * Production: any S3-compatible bucket (Backblaze B2, Cloudflare R2, MinIO...)
 * configured with S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID and
 * S3_SECRET_ACCESS_KEY. The bucket stays private; the app serves short-lived
 * signed URLs only to workspace members.
 * Local development without those variables: files go to .data/uploads.
 */
export interface Storage {
  readonly kind: "s3" | "local";
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** A URL the browser can load, or null when the app must stream the bytes itself. */
  signedUrl(key: string, expiresInSeconds: number): Promise<string | null>;
  read(key: string): Promise<Uint8Array>;
}

function s3Storage(): Storage {
  const bucket = process.env.S3_BUCKET!;
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
  return {
    kind: "s3",
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "private, max-age=31536000, immutable",
        }),
      );
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async signedUrl(key, expiresInSeconds) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    },
    async read(key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return res.Body!.transformToByteArray();
    },
  };
}

function localStorage(): Storage {
  // Development-only folder: excluded from output tracing so it is never bundled for deployment.
  const root = path.resolve(/*turbopackIgnore: true*/ process.env.LOCAL_UPLOAD_DIR ?? ".data/uploads");
  const resolve = (key: string) => {
    const full = path.resolve(/*turbopackIgnore: true*/ root, key);
    if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return full;
  };
  return {
    kind: "local",
    async put(key, body) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
    async signedUrl() {
      return null;
    },
    async read(key) {
      return new Uint8Array(await readFile(resolve(key)));
    },
  };
}

export function storageConfigured() {
  return Boolean(
    process.env.S3_BUCKET && process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
  );
}

let instance: Storage | null = null;

export function getStorage(): Storage {
  if (!instance) {
    if (storageConfigured()) instance = s3Storage();
    else if (process.env.VERCEL) throw new Error("Photo storage is not configured (S3_* variables)");
    else instance = localStorage();
  }
  return instance;
}
