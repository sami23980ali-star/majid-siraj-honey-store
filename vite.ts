import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : undefined;
  const serverOptions = {
    middlewareMode: true,
    // Reuse the already-listening HTTP server so the client connects through
    // the same origin. This preserves WSS for public HTTPS preview and WS locally.
    // نُعطّل HMR في المعاينة لأن الوكيل الخارجي قد يقطع WebSocket بصورة متقطعة.
    // تبقى الصفحة قابلة للاستخدام والتحديث اليدوي دون ظهور خطأ اتصال للمستخدم.
    hmr: false,
    ...(activePort ? { port: activePort, strictPort: true } : {}),
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  // The preview wrapper can inject /@vite/client after HTML transformation.
  // Serve a no-op module for that path so even an externally injected script
  // cannot start a WebSocket in this intentionally HMR-free preview.
  app.get("/@vite/client", (_req, res) => {
    res.status(200).type("application/javascript").send(`
      const styles = new Map();
      export const createHotContext = () => ({ accept() {}, dispose() {}, decline() {}, invalidate() {}, prune() {}, on() {}, send() {} });
      export const updateStyle = (id, content) => {
        let style = styles.get(id);
        if (!style) {
          style = document.createElement('style');
          style.setAttribute('data-vite-dev-id', id);
          document.head.appendChild(style);
          styles.set(id, style);
        }
        style.textContent = content;
      };
      export const removeStyle = (id) => {
        const style = styles.get(id);
        if (style) style.remove();
        styles.delete(id);
      };
    `);
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      let page = await vite.transformIndexHtml(url, template);
      // لا نحتاج عميل HMR في معاينة المستخدم، وحذفه يتجنب اتصال WebSocket
      // الذي قد يفشل عبر الوكيل الخارجي بينما تبقى وحدات التطبيق قابلة للتحميل.
      // Vite may reorder attributes or append a query string to this script.
      // Remove every script tag that references /@vite/client, not only one exact
      // attribute order, so the preview never attempts a WebSocket connection.
      page = page.replace(/<script\b[^>]*\/\@vite\/client[^>]*>[\\s\\S]*?<\/script>\s*/gi, "");
      page = page.replace(/<script\b[^>]*\/\@vite\/client[^>]*\/?>\s*/gi, "");
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // أسماء ملفات assets تحمل بصمة المحتوى، فتُخزَّن سنة كاملة بلا مراجعة. أما
  // index.html فيبقى بلا تخزين: نشرة جديدة تحذف البصمات القديمة، وصفحة محفوظة
  // تشير إليها تعني شاشة بيضاء عند الزائر.
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "no-cache");
      },
    })
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
