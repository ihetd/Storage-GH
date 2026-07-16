import { S3Client } from "@aws-sdk/client-s3";

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
