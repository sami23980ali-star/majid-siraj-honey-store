import { chromium } from "playwright-core";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(`${baseUrl}/track-order?order=MS-LINK-CHECK&phone=967700000000`, { waitUntil: "networkidle" });
  const orderNumber = await page.getByLabel("رقم الطلب").inputValue();
  const phone = await page.getByLabel("رقم الهاتف").inputValue();
  if (orderNumber !== "MS-LINK-CHECK" || phone !== "967700000000") throw new Error("لم تُملأ بيانات التتبع تلقائيًا من رابط التأكيد");
  console.log("تم التحقق: رابط تأكيد الطلب يملأ رقم الطلب والهاتف في صفحة التتبع دون إنشاء بيانات طلب.");
} finally {
  await browser.close();
}
