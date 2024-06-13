import { Hono } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import type { VNode } from "preact";
import { renderToReadableStream } from "preact-render-to-string/stream";
import { createFromReadableStream } from "preact-turbo";
import { injectRSCPayload } from "rsc-html-stream/server";

// @ts-expect-error - no types yet
import clientModules from "virtual:client-modules";

export function createSSRApp({
  callServer,
}: {
  callServer: (request: Request) => Promise<Response>;
}) {
  return new Hono().all(async (c) => {
    const serverResponse = await callServer(c.req.raw);
    if (!serverResponse.body) {
      throw new Error("Server response has no body");
    }

    const [rscStreamA, rscStreamB] = serverResponse.body.tee();

    for (const [key, value] of serverResponse.headers) {
      if (key.toLowerCase() === "set-cookie") continue;
      c.header(key, value, { append: true });
    }
    for (const cookie of serverResponse.headers.getSetCookie()) {
      c.header("set-cookie", cookie, { append: true });
    }
    c.header("content-type", "text/html; charset=utf-8", { append: false });
    c.status(serverResponse.status as StatusCode);
    const { done, value } = await createFromReadableStream(rscStreamA, {
      async loadClientReference(id: string, name: string) {
        if (import.meta.env.DEV) {
          const mod = await import(/* @vite-ignore */ id);
          return mod[name];
        }
        const mod = await clientModules[id]();
        return mod[name];
      },
    });
    done.catch(console.error);

    const htmlStream = renderToReadableStream((await value) as VNode);
    return c.body(htmlStream.pipeThrough(injectRSCPayload(rscStreamB)));
  });
}
