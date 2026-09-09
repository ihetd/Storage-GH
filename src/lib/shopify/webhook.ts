import { createHmac, timingSafeEqual } from "node:crypto";
import { getShopifyConfig } from "./config";

// Webhook authenticity.
//
// This endpoint is deliberately outside the app's login gate — Shopify cannot
// hold a session cookie — so the signature is the only thing standing between
// a stranger and the ability to move stock. Everything here assumes hostile
// input.

/**
 * Verify Shopify's HMAC over the raw request body.
 *
 * The body must be the exact bytes received. Parsing to JSON and
 * re-serialising changes whitespace and key order, and the signature will not
 * match — which is why the route reads text() before it reads anything else.
 */
export function verifyWebhookSignature(rawBody: string, headerHmac: string | null): boolean {
  const config = getShopifyConfig();
  if (!config || !headerHmac) return false;

  const expected = createHmac("sha256", config.clientSecret).update(rawBody, "utf8").digest();

  let received: Buffer;
  try {
    received = Buffer.from(headerHmac, "base64");
  } catch {
    return false;
  }

  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // expected length through the error path. Check first.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

/** The topics this app subscribes to. Anything else is acknowledged and ignored. */
export type WebhookTopic = "orders/create" | "orders/cancelled" | "refunds/create";

export function isHandledTopic(topic: string | null): topic is WebhookTopic {
  return topic === "orders/create" || topic === "orders/cancelled" || topic === "refunds/create";
}
