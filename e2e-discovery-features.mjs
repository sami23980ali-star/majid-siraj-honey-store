import { chromium } from "playwright-core";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const width = Number(process.env.E2E_WIDTH || 1280);
  const page = await browser.newPage({ viewport: { width, height: width <= 500 ? 812 : 720 } });
  await page.goto(`${baseUrl}/shop`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "كل المنتجات" }).click();
  await page.getByRole("button", { name: "المتوفر فقط" }).waitFor({ timeout: 8000 });
  await page.getByPlaceholder("ابحث عن نوع عسل…").fill("السدر");
  await page.getByText("عسل السدر الجبلي", { exact: true }).waitFor({ timeout: 8000 });
  const productLink = page.getByRole("link", { name: "عسل السدر الجبلي", exact: true }).first();
  await productLink.click();
  await page.getByRole("button", { name: "مشاركة المنتج عبر واتساب" }).waitFor({ timeout: 8000 });
  await page.evaluate(() => { window.__shareUrl = ""; window.open = (url) => { window.__shareUrl = String(url); return null; }; });
  await page.getByRole("button", { name: "مشاركة المنتج عبر واتساب" }).click();
  const shareUrl = await page.evaluate(() => window.__shareUrl);
  if (!shareUrl.includes("wa.me")) throw new Error("لم ينشئ زر المشاركة رابط واتساب");
  await page.goto(`${baseUrl}/shop`, { waitUntil: "networkidle" });
  await page.getByText("شاهدتها مؤخرًا", { exact: true }).waitFor({ timeout: 8000 });
  await page.getByText("عسل السدر الجبلي", { exact: true }).last().waitFor({ timeout: 8000 });
  console.log("تم التحقق: البحث، مشاركة واتساب، وسجل المشاهدة المحلي تعمل دون تغيير بيانات المتجر.");
} finally {
  await browser.close();
}
