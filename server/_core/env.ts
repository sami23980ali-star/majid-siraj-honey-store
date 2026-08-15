const SAME_SITE_VALUES = ["lax", "strict", "none"] as const;
type SameSite = (typeof SAME_SITE_VALUES)[number];

/**
 * Session cookies default to `lax`. Override to `none` only when the app is
 * served inside a third-party iframe (the hosted preview), because `lax`
 * cookies are withheld in embedded contexts. `none` re-opens the cookie to
 * cross-site requests, so it must stay opt-in.
 */
function readSameSite(): SameSite {
  const raw = process.env.SESSION_COOKIE_SAMESITE?.trim().toLowerCase();
  return SAME_SITE_VALUES.includes(raw as SameSite) ? (raw as SameSite) : "lax";
}

/**
 * Number of reverse-proxy hops in front of the app. Express uses it to pick the
 * real client address out of `x-forwarded-for`; too high a value lets clients
 * spoof their IP, so it defaults to a single hop.
 */
function readTrustProxyHops(): number {
  const parsed = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 1;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  /**
   * One-time secret that lets the store be claimed on a deployment where no
   * OWNER_OPEN_ID is known yet. Empty by default: with neither this nor an owner
   * identity configured, nobody can create the first admin account.
   */
  adminSetupToken: process.env.ADMIN_SETUP_TOKEN?.trim() ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN ?? "",
  shopifyStorefrontAccessToken: process.env.SHOPIFY_STOREFRONT_API_ACCESS_TOKEN ?? "",
  sessionCookieSameSite: readSameSite(),
  trustProxyHops: readTrustProxyHops(),
};
