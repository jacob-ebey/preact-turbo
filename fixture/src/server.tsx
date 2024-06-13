import { Hono } from "hono";
import { Suspense } from "preact/compat";
import type { ClientReference } from "preact-turbo";
import { renderToReadableStream } from "preact-turbo";

import browserEntry from "bridge:./browser.tsx";
import stylesEntry from "bridge:./global.css";

import { InfoDialog } from "./info-dialog.js";

console.log({ InfoDialog });

function Entry({ entry }: { entry: string }) {
  const baseId = entry.replace(/\?.*$/, "");
  if (import.meta.env.PROD && baseId.endsWith(".css")) {
    return <link rel="stylesheet" href={entry} />;
  }
  return <script async type="module" src={entry} />;
}

export function createServerApp() {
  return new Hono().get("/", async (c) => {
    c.header("content-type", "text/x-component; charset=utf-8");
    return c.body(
      renderToReadableStream(
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <title>Hello, World!</title>
            <Entry entry={stylesEntry} />
          </head>
          <body class="bg-white">
            <Suspense fallback="">
              <div>
                <div class="relative isolate px-6 lg:px-8">
                  <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
                    <div class="hidden sm:mb-8 sm:flex sm:justify-center">
                      <div class="relative rounded-full px-3 py-1 text-sm leading-6 text-gray-600 ring-1 ring-gray-900/10 hover:ring-gray-900/20">
                        Turbo Preact.{" "}
                        <a href="#" class="font-semibold text-indigo-600">
                          <span
                            class="absolute inset-0"
                            aria-hidden="true"
                          ></span>
                          Read more <span aria-hidden="true">&rarr;</span>
                        </a>
                      </div>
                    </div>
                    <div class="text-center">
                      <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                        Server Components
                        <br />
                        for Preact.
                      </h1>
                      <p class="mt-6 text-lg leading-8 text-gray-600">
                        Render all, or some of your components to a static tree
                        with support for async Server Components, and Client
                        Components via "use client".
                      </p>
                      <div class="mt-10 flex items-center justify-center gap-x-6">
                        <a
                          href="#"
                          class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                          Get started
                        </a>
                        <InfoDialog />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* <Counter /> */}
            </Suspense>
            <Entry entry={browserEntry} />
          </body>
        </html>,
        {
          serializeClientReference(
            clientReference: ClientReference & { $$id: string; $$name: string }
          ) {
            return [clientReference.$$id, clientReference.$$name];
          },
        }
      )
    );
  });
}
