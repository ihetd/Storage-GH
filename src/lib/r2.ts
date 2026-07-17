import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 (S3-compatible) helpers. Everything here tolerates missing
// credentials so the rest of the app works before R2 is set up: callers should
// check `isR2Configured()` first and degrade gracefully (the presign route
// returns 503, products save without a picture).

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string | null;
};

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || null,
  };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

export function getR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // AWS SDK v3 injects a CRC32 checksum by default; for presigned PUTs it bakes
    // an empty-payload checksum into the signed URL, which R2 then rejects (403)
    // once the real body is uploaded. Only add checksums when the API requires it.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

// Public URL for an uploaded object, if a public base is configured.
export function publicUrlForKey(
  config: R2Config,
  key: string,
): string | null {
  if (!config.publicBaseUrl) return null;
  return `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
}

// Best-effort delete of an uploaded object (used when a product image is
// replaced or its product is deleted, so the bucket doesn't accumulate
// orphans). Failures are swallowed: a stale object is harmless, whereas
// failing the user's save/delete over cleanup would be worse.
export async function deleteFromR2(key: string | null | undefined): Promise<void> {
  if (!key) return;
  const config = getR2Config();
  if (!config) return;
  try {
    await getR2Client(config).send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
    );
  } catch (e) {
    console.warn(`R2 cleanup failed for ${key}:`, e);
  }
}
