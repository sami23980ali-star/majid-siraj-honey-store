import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { assertEnvReady } from "./envGuard";
import { securityHeaders } from "./securityHeaders";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Before anything binds a port: a fatal finding must stop the boot, not become
  // a warning nobody reads in a healthy-looking log.
  assertEnvReady();

  const app = express();
  const server = createServer(app);

  // Needed so req.ip and req.protocol reflect the real client rather than the
  // proxy — the login audit trail and every per-IP rate limit depend on it.
  app.set("trust proxy", ENV.trustProxyHops);
  app.disable("x-powered-by");
  app.use(securityHeaders(ENV.isProduction));

  // Body limits sized to the largest legitimate payload: a base64 product video
  // (20 MB decoded ≈ 27 MB encoded). The previous 50 MB ceiling handed every
  // anonymous caller 20 MB of free slack. Nothing posts large form bodies.
  app.use(express.json({ limit: "30mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, resolve);
  });

  // Vite needs the active HTTP server and its actual listening port for HMR.
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  console.log(`Server running on http://localhost:${port}/`);
}

// A failed boot must exit non-zero so the platform restarts or reports it,
// instead of leaving a live process that never served a request.
startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
