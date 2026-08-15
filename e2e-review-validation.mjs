import { chromium } from "playwright-core";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const slug = "عسل-السدر-الجبلي-351164";
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLx4QAAAABJRU5ErkJggg==", "base64");
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${baseUrl}/products/${encodeURIComponent(slug)}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "اكتب مراجعتك" }).click();
  await page.getByLabel("الاسم").fill("مستخدم اختبار");
  await page.getByLabel("رقم الطلب").fill("MS-NOT-VALID");
  await page.getByLabel("رقم الهاتف المستخدم في الطلب").fill("967700000000");
  await page.getByLabel("مراجعتك").fill("هذه محاولة تحقق لن يتم حفظها لأنها لا ترتبط بطلب فعلي.");
  await page.locator('input[type="file"]').setInputFiles({ name: "review-check.png", mimeType: "image/png", buffer: tinyPng });
  await page.getByRole("button", { name: "إرسال للمراجعة" }).click();
  await page.getByText("تعذر التحقق من رقم الطلب أو الهاتف").waitFor({ timeout: 8000 });
  console.log("تم التحقق: يقبل النموذج صورة مرفقة ويمنع حفظ مراجعة لا تطابق طلبًا حقيقيًا.");
} finally {
  await browser.close();
}
