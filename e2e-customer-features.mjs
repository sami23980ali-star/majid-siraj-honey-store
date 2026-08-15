import { chromium } from "playwright-core";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${baseUrl}/shop`, { waitUntil: "networkidle" });
  const productName = await page.locator("article h2, article a.font-display").first().textContent();
  await page.getByRole("button", { name: "إضافة إلى المفضلة" }).first().click();
  await page.goto(`${baseUrl}/favorites`, { waitUntil: "networkidle" });
  if (!productName || await page.getByText(productName.trim(), { exact: true }).count() < 1) throw new Error("لم يظهر المنتج المحفوظ في صفحة المفضلة");
  await page.goto(`${baseUrl}/track-order`, { waitUntil: "networkidle" });
  await page.getByLabel("رقم الطلب").fill("MS-NOT-VALID");
  await page.getByLabel("رقم الهاتف").fill("967700000000");
  await page.getByRole("button", { name: "عرض حالة الطلب" }).click();
  await page.getByText("لم نعثر على طلب يطابق هذه البيانات").waitFor({ timeout: 8000 });
  console.log("تم التحقق: المفضلة تحفظ المنتج محليًا وتتبّع الطلب لا يكشف بيانات طلب غير مطابق.");
} finally {
  await browser.close();
}
