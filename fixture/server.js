import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { createServerApp } from "./dist/server/server.js";
import { createSSRApp } from "./dist/ssr/ssr.js";

const serverApp = createServerApp();
const ssrApp = createSSRApp({
  /**
   *
   * @param {Request} request
   */
  async callServer(request) {
    return await serverApp.fetch(request);
  },
});

const app = new Hono()
  .use(
    "/assets/*",
    serveStatic({
      root: "./dist/client",
    })
  )
  .route("*", ssrApp);

const port = Number.parseInt(process.env.PORT || "3000", 10);
serve({
  ...app,
  port,
});

console.log(`Server running at http://localhost:${port}`);
