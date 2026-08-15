import { describe, expect, it } from "vitest";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_FALLBACK_COOKIE } from "@shared/const";
import { getExpectedOAuthNonce } from "./_core/oauth";

describe("OAuth state cookie", () => {
  it("يقرأ nonce من الكوكي الآمن الأساسي", () => {
    expect(getExpectedOAuthNonce(`${OAUTH_STATE_COOKIE}=primary-nonce`)).toBe("primary-nonce");
  });

  it("يستخدم الكوكي البديل عندما لا يقبله سياق المتصفح", () => {
    expect(getExpectedOAuthNonce(`${OAUTH_STATE_FALLBACK_COOKIE}=fallback-nonce`)).toBe("fallback-nonce");
  });

  it("يرفض الحالة عند غياب الكوكي أو وجود قيمة فارغة", () => {
    expect(getExpectedOAuthNonce()).toBeUndefined();
    expect(getExpectedOAuthNonce(`${OAUTH_STATE_COOKIE}=wrong; ${OAUTH_STATE_FALLBACK_COOKIE}=fallback`)).toBe("wrong");
  });
});
