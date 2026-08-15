import { chromium } from "playwright-core";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.addInitScript(() => localStorage.setItem("majid-siraj-cart", JSON.stringify([{ productId: 2, name: "عسل السدر الجبلي", image: "/manus-storage/majid-siraj-sidr-honey_8cbc5572.jpg", option: { label: "250 جم", price: 12000 }, quantity: 1 }])));
  const page = await context.newPage();
  await page.goto(`${baseUrl}/cart`, { waitUntil: "networkidle" });
  await page.evaluate(() => { window.__checkoutUrl = ""; window.open = url => { window.__checkoutUrl = String(url); return null; }; });
  await page.getByRole("button", { name: "الدفع الإلكتروني الآمن" }).click();
  await page.waitForFunction(() => Boolean(window.__checkoutUrl), undefined, { timeout: 15000 });
  const checkoutUrl = await page.evaluate(() => window.__checkoutUrl);
  if (!checkoutUrl.includes("myshopify.com") || !checkoutUrl.includes("cart")) throw new Error("لم يُنشأ رابط الدفع الآمن من سلة Shopify");
  console.log("تم التحقق: سلة الدفع الآمن تنشئ رابط Shopify للإتمام دون تنفيذ عملية دفع أو طلب مكتمل.");
} finally {
  await browser.close();
}
