import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config, publicUrlForKey } from "@/lib/r2";

// Fetching a product photo named by a link in the sheet and storing it in R2.
//
// The link comes from a file someone uploaded, so it is untrusted input that
// this server will go and request. Everything below is about not letting a
// spreadsheet turn the app into an open fetcher.

const MAX_BYTES = 8 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function fetchImageToR2(
  rawUrl: string,
): Promise<{ imageUrl: string; imageKey: string } | null> {
  const config = getR2Config();
  if (!config) return null;
  // Without a public base there is no address to show the image at, so storing
  // it would only fill the bucket.
  if (!config.publicBaseUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Public web only. Without this a sheet could name an internal address and
  // have the server fetch something only it can reach.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  ) {
    return null;
  }

  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "image/*" },
  });
  if (!res.ok) return null;

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = EXT[contentType];
  if (!ext) return null;

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return null;

  const body = new Uint8Array(await res.arrayBuffer());
  // Checked again after reading: content-length is a claim, not a guarantee.
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return null;

  const imageKey = `products/${randomUUID()}.${ext}`;
  await getR2Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: imageKey,
      Body: body,
      ContentType: contentType,
    }),
  );

  const imageUrl = publicUrlForKey(config, imageKey);
  return imageUrl ? { imageUrl, imageKey } : null;
}
