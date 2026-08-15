import { chromium } from "playwright-core";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const slug = "عسل-السدر-الجبلي-351164";
const sampleVideo = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route("**/api/trpc/catalog.detail?**", async route => {
    const response = await route.fetch();
    const payload = await response.json();
    payload[0].result.data.json.galleryVideos = [sampleVideo];
    await route.fulfill({ response, contentType: "application/json", body: JSON.stringify(payload) });
  });
  await page.goto(`${baseUrl}/products/${encodeURIComponent(slug)}`, { waitUntil: "networkidle" });
  const videoButton = page.getByRole("button", { name: "عرض فيديو المنتج" });
  if (await videoButton.count() !== 1) throw new Error("لم يظهر زر فيديو المنتج في معرض الوسائط");
  await videoButton.click();
  if (await page.locator("video[controls]").count() !== 1) throw new Error("لم يظهر مشغل الفيديو بعد اختيار الفيديو من المعرض");
  console.log("تم التحقق: يعرض معرض المنتج فيديوً مضافًا ويبدله إلى المشغل الرئيسي دون تغيير بيانات المتجر.");
} finally {
  await browser.close();
}
