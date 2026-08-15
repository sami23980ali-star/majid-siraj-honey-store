import { describe, expect, it } from "vitest";
import { encodeOAuthState, decodeOAuthState } from "@shared/const";

describe("OAuth returnTo handling", () => {
  it("يشفر ويسترجع مسار العودة الآمن بداخل state", () => {
    const state = encodeOAuthState({ redirectUri: "https://example.com/api/oauth/callback", nonce: "123", returnTo: "/admin" });
    const decoded = decodeOAuthState(state);
    expect(decoded.returnTo).toBe("/admin");
  });

  it("يتجاهل مسارات العودة الخارجية غير الآمنة", () => {
    const state = encodeOAuthState({ redirectUri: "https://example.com/api/oauth/callback", nonce: "123", returnTo: "https://evil.com" });
    const decoded = decodeOAuthState(state);
    const safeRedirect = decoded.returnTo && decoded.returnTo.startsWith("/") ? decoded.returnTo : "/";
    expect(safeRedirect).toBe("/");
  });
});
