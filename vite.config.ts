import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { Readable } from "node:stream";
import { externalMediaKey } from "./lib/media-path";
import { serveExternalMedia } from "./app/api/media/route";
import { serveArchiveThumbnail } from "./lib/archive-thumbnail";

function rscDevFallbackGuard() {
  return {
    name: "rsc-dev-fallback-guard",
    configureServer(server: import("vite").ViteDevServer) {
      // Vinext's final RSC fallback sees image subresource requests before the
      // application route does in local development. Forward only this route
      // through the same access-controlled handler used in production.
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        const archivePrefix = "/api/archive/videos/";
        const archiveSuffix = "/thumbnail";
        if (url.pathname.startsWith(archivePrefix) && url.pathname.endsWith(archiveSuffix)) {
          try {
            const encodedId = url.pathname.slice(archivePrefix.length, -archiveSuffix.length);
            const result = await serveArchiveThumbnail(decodeURIComponent(encodedId), request.headers.cookie ?? null);
            response.statusCode = result.status;
            result.headers.forEach((value, name) => response.setHeader(name, value));
            if (!result.body) return response.end();
            Readable.fromWeb(result.body as never).pipe(response);
            return;
          } catch (error) {
            next(error as Error);
            return;
          }
        }
        const prefix = "/api/media/object/";
        if (!url.pathname.startsWith(prefix)) return next();

        try {
          const token = decodeURIComponent(url.pathname.slice(prefix.length));
          const result = await serveExternalMedia(
            externalMediaKey(token),
            request.headers.cookie ?? null,
          );
          response.statusCode = result.status;
          result.headers.forEach((value, name) => response.setHeader(name, value));
          if (!result.body) {
            response.end();
            return;
          }
          Readable.fromWeb(result.body as never).pipe(response);
        } catch (error) {
          next(error as Error);
        }
      });

      return () => {
        const environment = server.environments.rsc as unknown as {
          runner?: { import(id: string): Promise<unknown> };
        };
        // Nitro handles application routes in development. The RSC plugin still
        // installs a final fallback middleware, but Nitro's RSC environment does
        // not provide the standalone runner that middleware expects.
        environment.runner ??= {
          async import() {
            return { default: () => new Response("Not found", { status: 404 }) };
          },
        };
      };
    },
  };
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  plugins: [rscDevFallbackGuard(), tailwindcss(), vinext(), nitro()],
});
