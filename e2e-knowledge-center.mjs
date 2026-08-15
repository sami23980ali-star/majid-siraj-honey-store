import { chromium } from "playwright-core";

const baseUrl = process.env.STORE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(`${baseUrl}/knowledge`, { waitUntil: "networkidle" });
  await page.getByText("هل تبلور العسل طبيعي؟", { exact: true }).click();
  await page.getByText("قد يتغير قوام العسل", { exact: false }).waitFor({ timeout: 8000 });
  await page.getByRole("link", { name: "اقرأ المقال" }).first().click();
  await page.getByRole("heading", { name: "كيف تتعرّف إلى تنوع العسل البلدي؟" }).waitFor({ timeout: 8000 });
  console.log("تم التحقق: مركز المعرفة يفتح الأسئلة الشائعة وينتقل إلى مقال تفصيلي على الجوال.");
} finally {
  await browser.close();
}
