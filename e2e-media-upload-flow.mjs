import { chromium } from "playwright-core";
import { getPublicProduct, listAllProducts, updateProduct, uploadProductImage, uploadProductVideo } from "../server/db.ts";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLx4QAAAABJRU5ErkJggg==";
const sampleVideoUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const products = await listAllProducts();
const original = products[0];
if (!original) throw new Error("لا يتوفر منتج للتحقق من مسار الوسائط");
const { id, slug, ...originalInput } = original;
let changed = false;

try {
  const videoResponse = await fetch(sampleVideoUrl);
  if (!videoResponse.ok) throw new Error("تعذر جلب ملف الفيديو المؤقت للاختبار");
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
  const videoDataUrl = `data:video/mp4;base64,${videoBuffer.toString("base64")}`;

  const image = await uploadProductImage({ dataUrl: tinyPng, fileName: "media-flow-check.png" });
  const video = await uploadProductVideo({ dataUrl: videoDataUrl, fileName: "media-flow-check.mp4" });
  const changedInput = {
    ...originalInput,
    galleryImages: [...original.galleryImages, image.url],
    galleryVideos: [...original.galleryVideos, video.url],
  };
  await updateProduct(id, changedInput);
  changed = true;

  const saved = await getPublicProduct(slug);
  if (!saved?.galleryImages.includes(image.url) || !saved.galleryVideos.includes(video.url)) {
    throw new Error("لم تُحفظ وسائط الاختبار ضمن المنتج");
  }

  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`${baseUrl}/products/${encodeURIComponent(slug)}`, { waitUntil: "networkidle" });
    const videoButton = page.getByRole("button", { name: "عرض فيديو المنتج" });
    if (await videoButton.count() < 1) throw new Error("لم يظهر الفيديو المحفوظ في معرض صفحة المنتج");
    await videoButton.last().click();
    if (await page.locator(`video[controls][src="${video.url}"]`).count() !== 1) throw new Error("لم يعمل مشغل الفيديو المحفوظ في صفحة المنتج");
    if (await page.locator(`img[src="${image.url}"]`).count() < 1) throw new Error("لم تظهر الصورة المحفوظة في معرض صفحة المنتج");
  } finally {
    await browser.close();
  }
  console.log("تم التحقق عمليًا: رُفعت صورة وفيديو، حُفظا في المنتج، وظهرا في صفحة المنتج.");
} finally {
  if (changed) await updateProduct(id, originalInput);
  console.log("تمت استعادة بيانات المنتج الأصلية بعد الاختبار.");
}
