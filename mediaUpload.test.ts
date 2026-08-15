import { describe, expect, it, vi } from "vitest";
import { parseProductMediaDataUrl } from "./mediaUpload";

const encoded = Buffer.from("media-test").toString("base64");

describe("parseProductMediaDataUrl", () => {
  it("يقبل أنواع الفيديو المدعومة ويعيد البيانات اللازمة للتخزين", () => {
    const result = parseProductMediaDataUrl(`data:video/mp4;base64,${encoded}`, "video");
    expect(result.mimeType).toBe("video/mp4");
    expect(result.extension).toBe("mp4");
    expect(result.buffer.toString()).toBe("media-test");
  });

  it("يرفض محتوى الفيديو غير المدعوم", () => {
    expect(() => parseProductMediaDataUrl(`data:video/avi;base64,${encoded}`, "video")).toThrow("صيغة الفيديو غير مدعومة");
  });

  it("يبقي تحقق الصور منفصلًا عن تحقق الفيديوهات", () => {
    expect(() => parseProductMediaDataUrl(`data:video/mp4;base64,${encoded}`, "image")).toThrow("صيغة الصورة غير مدعومة");
  });

  it("يرفض الحجم الزائد بالاعتماد على طول النص قبل فك الترميز", () => {
    // 8 MB of base64 characters ≈ 6 MB decoded, over the 4 MB image ceiling. The
    // rejection must happen without allocating the decoded buffer.
    const oversizeImage = "A".repeat(8 * 1024 * 1024);
    const decodeSpy = vi.spyOn(Buffer, "from");
    expect(() => parseProductMediaDataUrl(`data:image/png;base64,${oversizeImage}`, "image")).toThrow("يجب ألا تتجاوز الصورة 4 ميجابايت");
    expect(decodeSpy).not.toHaveBeenCalled();
    decodeSpy.mockRestore();
  });

  it("يرفض الفيديو الذي يتجاوز عشرين ميجابايت", () => {
    const oversizeVideo = "A".repeat(28 * 1024 * 1024);
    expect(() => parseProductMediaDataUrl(`data:video/mp4;base64,${oversizeVideo}`, "video")).toThrow("يجب ألا يتجاوز الفيديو 20 ميجابايت");
  });

  it("يرفض المحتوى الفارغ", () => {
    const emptyPayload = Buffer.from("").toString("base64");
    expect(() => parseProductMediaDataUrl(`data:image/png;base64,${emptyPayload}`, "image")).toThrow("صيغة الصورة غير مدعومة");
  });
});
