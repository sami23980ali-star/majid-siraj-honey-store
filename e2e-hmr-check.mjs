import { chromium } from "playwright-core";

const previewUrl = process.env.PREVIEW_URL || "https://3000-irtcqfje51ty46nr6i515-04739b01.us1.manus.computer";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(previewUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const hmrErrors = errors.filter(error => /vite|websocket|hmr/i.test(error));
  if (hmrErrors.length) throw new Error(`ظهر خطأ HMR/WebSocket: ${hmrErrors.join(" | ")}`);
  console.log("تم التحقق: معاينة النطاق العام لم تسجل أخطاء HMR أو WebSocket.");
} finally {
  await browser.close();
}
