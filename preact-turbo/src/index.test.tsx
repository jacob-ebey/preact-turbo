import * as assert from "node:assert/strict";
import { test } from "node:test";

import type { VNode } from "preact";
import { FC, Suspense } from "preact/compat";
import { renderToReadableStream as renderToHTML } from "preact-render-to-string/stream";

import type { ClientReference } from "./index.js";
import { createFromReadableStream, renderToReadableStream } from "./index.js";

const defaultChildren = <p>it works</p>;

const ClientComponent = {
  $$typeof: Symbol.for("preact.client.reference"),
  $$id: "ClientComponent",
} as unknown as FC;

async function renderToString(element: unknown) {
  const root = await createFromReadableStream(
    renderToReadableStream(element, {
      serializeClientReference: (
        clientReference: ClientReference & { $$id: string }
      ) => {
        if (!clientReference.$$id) {
          throw new Error("Client reference has no ID");
        }

        return [clientReference.$$id];
      },
    }),
    {
      loadClientReference: async (id: string) => {
        if (id === "ClientComponent") {
          return () => defaultChildren;
        }
        throw new Error(`Unknown client reference: ${id}`);
      },
    }
  );

  return new Response(renderToHTML(root.value as VNode)).text();
}

class Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

function createSuspender() {
  const deferred = new Deferred<void>();
  async function Suspender({ children = defaultChildren }) {
    await deferred.promise;
    return children;
  }

  return {
    suspended: deferred,
    Suspender: Suspender as unknown as (props: { children?: VNode }) => VNode,
  };
}

test("renders basic tree", async (t) => {
  const element = <div>Hello, world!</div>;
  const html = await renderToString(element);
  assert.equal(html, "<div>Hello, world!</div>");
});

test("should render fallback + attach loaded subtree on suspend", async () => {
  const { Suspender, suspended } = createSuspender();
  const element = (
    <div>
      <Suspense fallback="loading...">
        <Suspender />
      </Suspense>
    </div>
  );
  const htmlPromise = renderToString(element);
  suspended.resolve();
  const html = await htmlPromise;
  assert.equal(html.includes("-->loading...<!--/preact-island"), true);
  assert.equal(html.includes("<p>it works</p></preact-island>"), true);
});

test.only("should render fallback + attach loaded subtree on suspend with client component", async () => {
  const { Suspender, suspended } = createSuspender();

  const element = (
    <div>
      <Suspense fallback="loading...">
        <Suspender>
          <ClientComponent />
        </Suspender>
      </Suspense>
    </div>
  );
  const htmlPromise = renderToString(element);
  suspended.resolve();
  const html = await htmlPromise;
  assert.equal(html.includes("-->loading...<!--/preact-island"), true);
  assert.equal(html.includes("<p>it works</p></preact-island>"), true);
});
