// std
import { join, resolve } from "path";

// lib
import type { StreamReactViewPluginOptions } from "../types";
import { ISLAND_RUNTIME_GLOBAL_NAME } from "../constants";
import { bundleCode } from "./bundleCode";

export default async function bundleRuntime(
  options: StreamReactViewPluginOptions,
) {
  try {
    console.log(`[ssr] Bundling Islands runtime for browser...`);
    await bundleCode({
      externalDependencies: options?.externalDependencies,
      globalName: ISLAND_RUNTIME_GLOBAL_NAME,
      minify: process.env.NODE_ENV === "production",
      entryFile: resolve(join(__dirname, "../../src/runtime/index.ts")),
      outFolder: options.assetsOutFolder,
      outFileName: `islands-runtime`,
      isBundleJsExt: false,
      withStyledSSR: options.withStyledSSR,
      withImportsMap: options.withImportsMap,
      workingDirectory: options.rootFolder,
    });
    console.log(`[ssr] Bundled Islands runtime for browser!`);
  } catch (err) {
    const error = err as Error;
    console.error(
      `[ssr] Could not bundle Islands runtime for browser. Error:`,
      error.message,
    );
  }
}
