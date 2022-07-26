// std
import { join, resolve } from "path";
// lib
import type { ReactIsland, StreamReactViewPluginOptions } from "../types";
import { bundleCode } from "./bundleCode";

export default async function bundleIslands(
  islandsById: Record<string, [string, ReactIsland<{}>]>,
  options: StreamReactViewPluginOptions,
) {
  try {
    console.log("[ssr] Generating Islands bundles...");
    await Promise.all(
      Object.entries(islandsById).map(async ([islandId]) => {
        try {
          console.log(`[ssr] Bundling Island "${islandId}" for browser...`);
          await bundleCode({
            externalDependencies: options?.externalDependencies,
            globalName: islandId,
            minify: process.env.NODE_ENV === "production",
            entryFile:
              process.env.NODE_ENV === "production"
                ? resolve(join(options.islandsFolder, `${islandId}.js`))
                : resolve(join(options.islandsFolder, `${islandId}.tsx`)),
            outFolder: resolve(join(options.assetsOutFolder, ".islands")),
            outFileName: `${islandId}.bundle`,
            withStyledSSR: options.withStyledSSR,
            workingDirectory: options.rootFolder,
          });
          console.log(`[ssr] Bundled Island "${islandId}" for browser!`);
        } catch (err) {
          const error = err as Error;
          console.error(
            `[ssr] Could not bundle Island "${islandId}" for browser. Error:`,
            error.message,
          );
        }
      }),
    );
    console.log("[ssr] Islands bundles generated!");
  } catch (err) {
    const error = err as Error;
    console.error("[ssr] Could not bundle islands. Error:", error.message);
  }
}
