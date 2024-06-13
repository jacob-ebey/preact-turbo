import * as path from "node:path";
import * as fsp from "node:fs/promises";

import { getRequestListener } from "@hono/node-server";
import preact from "@preact/preset-vite";
import type { Hono } from "hono";
import turbo, { rscSingleton } from "preact-turbo/vite";
import type { Rollup } from "vite";
import { createServerModuleRunner, defineConfig } from "vite";

declare global {
  var clientBuildPromise:
    | Promise<
        Rollup.RollupOutput | Rollup.RollupOutput[] | Rollup.RollupWatcher
      >
    | undefined;
}

global.clientBuildPromise = global.clientBuildPromise || undefined;

const pkg = JSON.parse(await fsp.readFile("./package.json", "utf-8"));

export default defineConfig({
  builder: {
    async buildApp(builder) {
      let clientModules = rscSingleton.clientModules.size;
      do {
        clientModules = rscSingleton.clientModules.size;
        clientBuildPromise = builder.build(builder.environments.client);
        await builder.build(builder.environments.ssr);
        await builder.build(builder.environments.server);
        await clientBuildPromise;
      } while (clientModules !== rscSingleton.clientModules.size);
    },
  },
  build: {
    rollupOptions: {
      preserveEntrySignatures: "exports-only",
    },
  },
  environments: {
    client: {
      build: {
        manifest: true,
        outDir: "dist/client",
        rollupOptions: {
          input: ["/src/browser.tsx", "/src/global.css"],
        },
      },
    },
    ssr: {
      build: {
        ssr: true,
        outDir: "dist/ssr",
        rollupOptions: {
          input: ["/src/ssr.ts"],
        },
      },
      nodeCompatible: true,
    },
    server: {
      build: {
        ssr: true,
        outDir: "dist/server",
        rollupOptions: {
          input: ["/src/server.tsx"],
        },
      },
      nodeCompatible: true,
    },
  },
  plugins: [
    turbo({ serverEnvironments: ["server"] }),
    preact(),
    {
      name: "dev-server",
      configureServer(server) {
        const serverRunner = createServerModuleRunner(
          server.environments.server
        );
        const ssrRunner = createServerModuleRunner(server.environments.ssr);

        return () => {
          server.middlewares.use(async (req, res, next) => {
            try {
              req.url = req.originalUrl;

              const [{ createSSRApp }, { createServerApp }] = await Promise.all(
                [
                  ssrRunner.import("/src/ssr.ts"),
                  serverRunner.import("/src/server.tsx"),
                ]
              );

              const serverApp = createServerApp() as Hono;
              const ssrApp = createSSRApp({
                async callServer(request: Request) {
                  return await serverApp.fetch(request);
                },
              }) as Hono;
              const listener = getRequestListener(ssrApp.fetch);
              await listener(req, res);
            } catch (reason) {
              next(reason);
            }
          });
        };
      },
    },
    {
      name: "bridged-assets",
      async resolveId(id, importer) {
        if (id.startsWith("bridge:")) {
          if (!this.environment?.config.ssr) {
            throw new Error("Cannot bridge assets from a client build.");
          }

          const baseId = id.slice("bridge:".length);
          const postfix = this.environment.config.command !== "build" ? "" : "";
          const resolved = await this.resolve(baseId + postfix, importer, {
            skipSelf: true,
          });
          if (!resolved) {
            throw new Error(`Could not resolve asset: ${baseId}`);
          }

          // The # is to stop vite from trying to transform the asset.
          return `\0bridge:${resolved.id}#`;
        }
      },
      async load(id) {
        if (id.startsWith("\0bridge:") && id.endsWith("#")) {
          if (!this.environment?.config.ssr) {
            throw new Error("Cannot bridge assets from a client build.");
          }
          const baseId = id.slice("\0bridge:".length, -1);
          const relative = path
            .relative(this.environment.config.root, baseId)
            .replace(/\\/g, "/");

          if (this.environment.config.command !== "build") {
            return `export default "/${relative}";`;
          }

          if (!clientBuildPromise) {
            throw new Error("Client build promise not set.");
          }
          const clientBuildResults = await clientBuildPromise;
          const clientBuild = clientBuildResults as Rollup.RollupOutput;

          const manifest = clientBuild.output.find(
            (o) => o.fileName === ".vite/manifest.json"
          );
          if (
            !manifest ||
            !("source" in manifest) ||
            typeof manifest.source !== "string"
          ) {
            throw new Error("Could not find client manifest.");
          }
          const manifestJson = JSON.parse(manifest.source);
          let manifestFile = manifestJson[relative]?.file as string | undefined;

          if (!manifestFile) {
            const output = clientBuild.output.find(
              (o) => "facadeModuleId" in o && o.facadeModuleId === baseId
            );
            if (!output) {
              throw new Error(`Could not find browser output for ${baseId}`);
            }
            manifestFile = output.fileName;
          }

          return `export default "${this.environment.config.base}${manifestFile}";`;
        }
      },
    },
  ],
});
