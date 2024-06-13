import type { VNode } from "preact";
import { hydrate } from "preact";
import { createFromReadableStream } from "preact-turbo";
import { rscStream } from "rsc-html-stream/client";

// @ts-expect-error - no types yet
import clientModules from "virtual:client-modules";

const devStyles = import.meta.env.DEV
  ? document.querySelectorAll('style[data-vite-dev-id][type="text/css"]')
  : undefined;

createFromReadableStream(rscStream, {
  async loadClientReference(id: string, name: string) {
    if (import.meta.env.DEV) {
      const mod = await import(/* @vite-ignore */ id);
      return mod[name];
    }
    const mod = await clientModules[id]();
    return mod[name];
  },
})
  .then(({ done, value }) => {
    requestAnimationFrame(() => {
      hydrate(value as VNode, document);
      if (import.meta.env.DEV) document.head.append(...devStyles!);
    });
    return done;
  })
  .catch(console.error);
