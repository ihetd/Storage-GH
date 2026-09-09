import { prisma } from "@/lib/prisma";
import { getShopifyConfig, type ShopifyConfig } from "./config";

// Shopify Admin API access.
//
// Custom apps created in the Dev Dashboard no longer hand out a long-lived
// token: credentials are exchanged for one that expires after 24 hours, so a
// token is minted, stored and reused rather than fetched per call. The store is
// the database rather than module state because serverless instances are
// short-lived and plentiful — an in-memory cache would mint a fresh token for
// almost every request.

const TOKEN_ROW_ID = "singleton";

// Refresh a minute early. A token that expires mid-flight fails the call it was
// fetched for, and the margin costs nothing.
const EXPIRY_MARGIN_MS = 60_000;

export class ShopifyError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ShopifyError";
  }
}

type TokenResponse = {
  access_token?: string;
  scope?: string;
  expires_in?: number;
};

async function mintToken(config: ShopifyConfig) {
  const res = await fetch(`https://${config.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ShopifyError(
      `Could not get a Shopify access token (HTTP ${res.status}). Check that the app is installed on this store and the credentials are correct.`,
    );
  }

  const body = (await res.json()) as TokenResponse;
  if (!body.access_token) {
    throw new ShopifyError("Shopify returned no access token.", body);
  }

  const expiresAt = new Date(Date.now() + (body.expires_in ?? 86_400) * 1000);
  const record = {
    accessToken: body.access_token,
    scope: body.scope ?? "",
    expiresAt,
  };

  // Two requests racing to mint is harmless — Shopify issues both, and the
  // later upsert simply wins. Not worth a lock.
  await prisma.shopifyToken.upsert({
    where: { id: TOKEN_ROW_ID },
    create: { id: TOKEN_ROW_ID, ...record },
    update: record,
  });

  return body.access_token;
}

export async function getAccessToken(config: ShopifyConfig): Promise<string> {
  const stored = await prisma.shopifyToken.findUnique({ where: { id: TOKEN_ROW_ID } });

  if (stored && stored.expiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now()) {
    return stored.accessToken;
  }
  return mintToken(config);
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};

/**
 * Run a GraphQL query against the Admin API.
 *
 * Throws ShopifyError on transport failure or GraphQL errors. Callers that can
 * carry on without Shopify should catch — nothing here should be able to take
 * the stock screens down.
 */
export async function shopifyGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const config = getShopifyConfig();
  if (!config) {
    throw new ShopifyError("Shopify is not configured (environment variables unset).");
  }

  const run = async (token: string) =>
    fetch(`https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

  let token = await getAccessToken(config);
  let res = await run(token);

  // A stored token can be revoked before it expires — reinstalling the app does
  // it. One forced refresh distinguishes that from a genuine auth problem.
  if (res.status === 401) {
    token = await mintToken(config);
    res = await run(token);
  }

  if (!res.ok) {
    throw new ShopifyError(`Shopify Admin API returned HTTP ${res.status}.`, await res.text());
  }

  const body = (await res.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new ShopifyError(body.errors.map((e) => e.message).join("; "), body.errors);
  }
  if (!body.data) {
    throw new ShopifyError("Shopify returned an empty response.");
  }
  return body.data;
}
