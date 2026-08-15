const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

type MediaKind = "image" | "video";

/** Base64 carries 3 bytes per 4 characters; used to reject before decoding. */
function decodedByteEstimate(base64: string) {
  return Math.floor((base64.length * 3) / 4);
}

export function parseProductMediaDataUrl(dataUrl: string, kind: MediaKind) {
  const mimeTypes = kind === "image" ? IMAGE_MIME_TYPES : VIDEO_MIME_TYPES;
  const maxBytes = kind === "image" ? 4 * 1024 * 1024 : 20 * 1024 * 1024;
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  const error = kind === "image" ? "صيغة الصورة غير مدعومة" : "صيغة الفيديو غير مدعومة. استخدم MP4 أو WEBM أو MOV";
  if (!match || !mimeTypes.includes(match[1] as never)) throw new Error(error);
  const mimeType = match[1];
  const sizeError = kind === "image" ? "يجب ألا تتجاوز الصورة 4 ميجابايت" : "يجب ألا يتجاوز الفيديو 20 ميجابايت";
  // Size is checked against the encoded length first: decoding an oversized
  // payload only to reject it would allocate the full buffer for nothing.
  if (decodedByteEstimate(match[2]) > maxBytes) throw new Error(sizeError);
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new Error(sizeError);
  }
  const extension = mimeType === "video/quicktime" ? "mov" : mimeType.split("/")[1];
  return { mimeType, buffer, extension };
}
