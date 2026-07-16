import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { requireApiRole } from "@/lib/rbac";
import { getR2Config, getR2Client, publicUrlForKey } from "@/lib/r2";

const bodySchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).default(
    "image/jpeg",
  ),
});

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// POST /api/uploads/presign → { uploadUrl, imageKey, imageUrl }
// ADMIN only. Returns 503 (not an error the form should crash on) when R2 is
// not configured, so the product form can offer to save without an image.
export async function POST(req: Request) {
  const gate = await requireApiRole(["ADMIN"]);
  if (gate instanceof NextResponse) return gate;

  const config = getR2Config();
  if (!config) {
    return NextResponse.json(
      { error: "Image uploads are not configured (R2 env vars unset)." },
      { status: 503 },
    );
  }

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    // default body is fine
  }
  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { contentType } = parsed.data;
  const imageKey = `products/${randomUUID()}.${EXT[contentType]}`;

  const client = getR2Client(config);
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: imageKey,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  );

  return NextResponse.json({
    uploadUrl,
    imageKey,
    imageUrl: publicUrlForKey(config, imageKey),
    contentType,
  });
}
