import { chromium } from "playwright-core";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.addInitScript(() => localStorage.setItem("majid-siraj-cart", JSON.stringify([{ productId: 1, name: "عسل السدر الجبلي", image: "/manus-storage/majid-siraj-sidr-honey_8cbc5572.jpg", option: { label: "250 جم", price: 12000 }, quantity: 1 }])));
  const page = await context.newPage();
  await page.route("**/api/trpc/orders.create**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ result: { data: { json: { orderNumber: "MS-CONFIRM-CHECK", whatsappUrl: "https://wa.me/967773207714?text=test-order" } } } }) }));
  await page.goto(`${baseUrl}/cart`, { waitUntil: "networkidle" });
  await page.getByLabel("الاسم الكامل").fill("اختبار التدفق");
  await page.getByLabel("رقم الهاتف").fill("967700000000");
  await page.evaluate(() => { window.__whatsappUrl = ""; window.open = url => { window.__whatsappUrl = String(url); return null; }; });
  await page.getByRole("button", { name: "تأكيد وإرسال عبر واتساب" }).click();
  await page.getByText("شكرًا لطلبك", { exact: true }).waitFor({ timeout: 8000 });
  await page.getByText("MS-CONFIRM-CHECK", { exact: true }).waitFor({ timeout: 8000 });
  const whatsappUrl = await page.evaluate(() => window.__whatsappUrl);
  if (!whatsappUrl.includes("wa.me")) throw new Error("لم يُفتح رابط واتساب من شاشة التأكيد");
  const trackingHref = await page.getByRole("main").getByRole("link", { name: "تتبع طلبي" }).getAttribute("href");
  if (!trackingHref?.includes("order=MS-CONFIRM-CHECK") || !trackingHref.includes("phone=967700000000")) throw new Error("رابط التتبع لا يحمل بيانات الطلب");
  console.log("تم التحقق: شاشة تأكيد الطلب تعرض الرقم وتفتح رابط واتساب وترتبط بتتبع الطلب دون حفظ طلب اختبار.");
} finally {
  await browser.close();
}
