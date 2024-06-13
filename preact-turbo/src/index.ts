import type { VNode } from "preact";
import { Fragment, h, options } from "preact";
import type { FC } from "preact/compat";
import { Suspense, SuspenseList } from "preact/compat";
import { decode, encode } from "turbo-stream";

const ELEMENT_SYMBOL = Symbol.for("react.element");
// Options hooks
const DIFF = "__b";
const RENDER = "__r";
const DIFFED = "diffed";
const COMMIT = "__c";
const SKIP_EFFECTS = "__s";
const CATCH_ERROR = "__e";

// VNode properties
const COMPONENT = "__c";
const CHILDREN = "__k";
const PARENT = "__";
const MASK = "__m";

// Component properties
const VNODE = "__v";
const DIRTY = "__d";
const NEXT_STATE = "__s";
const CHILD_DID_SUSPEND = "__c";

const EMPTY_ARR = [];
const isArray = Array.isArray;
const assign = Object.assign;

const CLIENT_REFERENCE_SYMBOL = Symbol.for("preact.client.reference");

function markAsDirty() {
  this.__d = true;
}

export type ClientReference = {
  $$typeof: typeof CLIENT_REFERENCE_SYMBOL;
};

export type SerializeClientReferenceFunction = (
  clientReference: any
) => unknown[];

export function renderToReadableStream(
  root: unknown,
  {
    serializeClientReference,
    signal,
  }: {
    serializeClientReference?: SerializeClientReferenceFunction;
    signal?: AbortSignal;
  } = {}
) {
  let parent = h(Fragment, null);

  return encode(root, {
    signal,
    plugins: [
      (value) => {
        if (
          value &&
          typeof value === "object" &&
          "$$typeof" in value &&
          value.$$typeof === ELEMENT_SYMBOL
        ) {
          const vnode = value as unknown as VNode;
          try {
            const type = vnode.type as typeof vnode.type | ClientReference;
            const key = vnode.key;
            const props = vnode.props;

            // parent[CHILDREN] = [vnode];

            // Performance optimization: `renderToString` is synchronous and we
            // therefore don't execute any effects. To do that we pass an empty
            // array to `options._commit` (`__c`). But we can go one step further
            // and avoid a lot of dirty checks and allocations by setting
            // `options._skipEffects` (`__s`) too.
            // const previousSkipEffects = options[SKIP_EFFECTS];
            // options[SKIP_EFFECTS] = true;

            // // store options hooks once before each synchronous render call
            // let beforeDiff = options[DIFF];
            // let afterDiff = options[DIFFED];
            // let renderHook = options[RENDER];
            // let ummountHook = options.unmount;

            // vnode[PARENT] = parent;
            // if (beforeDiff) beforeDiff(vnode);

            switch (typeof type) {
              case "string":
                return ["e", key, type, props];
              case "function":
                switch (type) {
                  case Fragment:
                    return ["f", key, props];
                  case Suspense:
                    return ["s", key, props];
                  case SuspenseList:
                    return ["l", key, props];
                  default: {
                    let rendered;
                    try {
                      // const component = {
                      //   __v: vnode,
                      //   props,
                      //   context: undefined,
                      //   // silently drop state updates
                      //   setState: markAsDirty,
                      //   forceUpdate: markAsDirty,
                      //   __d: true,
                      //   // hooks
                      //   __h: [],
                      // };
                      // vnode[COMPONENT] = component;

                      // If a hook invokes setState() to invalidate the component during rendering,
                      // re-render it up to 25 times to allow "settling" of memoized states.
                      // Note:
                      //   This will need to be updated for Preact 11 to use internal.flags rather than component._dirty:
                      //   https://github.com/preactjs/preact/blob/d4ca6fdb19bc715e49fd144e69f7296b2f4daa40/src/diff/component.js#L35-L44
                      // let count = 0;
                      // while (component[DIRTY] && count++ < 25) {
                      //   component[DIRTY] = false;

                      // if (renderHook) renderHook(vnode);

                      rendered = type.call(null, props);
                      // }
                      // component[DIRTY] = true;
                    } catch (reason) {
                      rendered = Promise.reject(reason);
                    } finally {
                      // if (afterDiff) afterDiff(vnode);
                      // vnode[PARENT] = null;
                      // if (ummountHook) ummountHook(vnode);
                      // // options._commit, we don't schedule any effects in this library right now,
                      // // so we can pass an empty queue to this hook.
                      // if (options[COMMIT]) options[COMMIT](vnode, EMPTY_ARR);
                      // options[SKIP_EFFECTS] = previousSkipEffects;
                      // EMPTY_ARR.length = 0;
                    }

                    return ["c", key, rendered];
                  }
                }
              case "object":
                if (
                  type &&
                  "$$typeof" in type &&
                  type.$$typeof === CLIENT_REFERENCE_SYMBOL
                ) {
                  if (!serializeClientReference) {
                    throw new Error(
                      "serializeClientReference is required to serialize client references"
                    );
                  }
                  const serialized = serializeClientReference(type);
                  return ["r", key, props, ...serialized];
                }
                throw new Error(`Unsupported type: ${type}`);
              default:
                throw new Error(`Unsupported type: ${type}`);
            }
          } finally {
            parent = vnode;
          }
        }

        return false;
      },
    ],
  });
}

class Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

function createSuspender() {
  const deferred = new Deferred();

  const resolved = {};
  deferred.promise.then(
    (value) => {
      (resolved as any).value = value;
    },
    (error) => {
      (resolved as any).error = error;
    }
  );
  function Suspender(): VNode {
    if ("error" in resolved) throw resolved.error;
    if ("value" in resolved) return resolved.value as VNode;
    throw deferred.promise;
  }

  return {
    deferred,
    Suspender,
  };
}

export type LoadClientReferenceFunction = (
  ...args: any[]
) => Promise<FC<unknown>>;

export function createFromReadableStream(
  stream: ReadableStream<Uint8Array>,
  {
    loadClientReference,
  }: {
    loadClientReference?: LoadClientReferenceFunction;
  } = {}
) {
  return decode(stream, {
    plugins: [
      (type, ...data) => {
        switch (type) {
          case "e": {
            const [key, type, props] = data as [string, string, any];
            return { value: h(type, assign({ key }, props)) };
          }
          case "f": {
            const [key, props] = data;
            return { value: h(Fragment, assign({ key }, props)) };
          }
          case "s": {
            const [key, props] = data;
            return { value: h(Suspense, assign({ key }, props) as any) };
          }
          case "l": {
            const [key, props] = data;
            return { value: h(SuspenseList, assign({ key }, props)) };
          }
          case "c": {
            const [key, rendered] = data;
            if (
              rendered &&
              typeof rendered === "object" &&
              "then" in rendered &&
              typeof rendered.then === "function"
            ) {
              const { Suspender, deferred } = createSuspender();
              (rendered as Promise<VNode>).then(
                deferred.resolve,
                deferred.reject
              );

              return { value: h(Suspender, { key }) };
            }
            return { value: rendered };
          }
          case "r": {
            if (!loadClientReference) {
              throw new Error(
                "loadClientReference is required to load client references"
              );
            }
            const [key, props, ...args] = data;
            const renderPromise = loadClientReference(...args).then(
              (Component) => {
                return h(Component, assign({ key }, props));
              }
            );
            const { Suspender, deferred } = createSuspender();
            renderPromise.then(deferred.resolve, deferred.reject);
            return { value: h(Suspender, { key }) };
          }
        }
        return false;
      },
    ],
  });
}
