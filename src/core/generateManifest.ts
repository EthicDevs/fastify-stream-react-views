// std
import { createHash } from "crypto";
import { join, resolve } from "path";
import { stat, readFile, writeFile } from "fs/promises";

// lib
import type {
  IManifest,
  ManifestResource,
  ReactIsland,
  ReactView,
  StreamReactViewPluginOptions,
} from "../types";

import { default as bundleIslands } from "./bundleIslands";
import { default as bundleRuntime } from "./bundleRuntime";
import { walkFolderForFiles } from "../helpers";
import { readFileSync } from "fs";

const HASH_ALGORITHM = "sha1";

export default async function generateManifest({
  islands,
  views,
  options,
}: {
  views?: Record<string, [string, ReactView]>;
  islands?: Record<string, [string, ReactIsland]>;
  options: StreamReactViewPluginOptions;
}) {
  const manifest: IManifest = {
    _generatedAtUnix: Date.now(),
    _hashAlgorithm: HASH_ALGORITHM,
    _version: 2,
    islands: {},
    views: {},
  };

  // { [viewName]: [viewPath, View] }
  let _views: Record<string, [string, ReactView]> | null = null;
  if (views) {
    _views = views;
  } else if (options != null && options.viewsFolder != null) {
    const filesViews = await walkFolderForFiles<ReactView>(options.viewsFolder);
    if (filesViews) {
      _views = filesViews;
    }
  }

  if (_views != null) {
    manifest.views = Object.entries(_views).reduce(
      (acc, [viewId, [viewPath, View]]) => {
        const viewContents = readFileSync(viewPath, { encoding: "utf-8" });
        acc = {
          ...acc,
          [viewId]: {
            hash: createHash(HASH_ALGORITHM)
              .update(`${viewId}-${viewPath}-${viewContents}`)
              .digest("hex"),
            pathSource: "." + viewPath.replace(options.rootFolder, ""),
            res: View,
          } as ManifestResource<ReactView>,
        };
        return acc;
      },
      {},
    );
  }

  let _islands: Record<string, [string, ReactIsland]> | null = null;
  if (islands) {
    _islands = islands;
  } else if (options != null && options.islandsFolder != null) {
    const filesIslands = await walkFolderForFiles<ReactIsland>(
      options.islandsFolder,
    );
    if (filesIslands) {
      _islands = filesIslands;
    }
  }

  if (_islands) {
    manifest.islands = Object.entries(_islands).reduce(
      (acc, [islandId, [islandPath, Island]]) => {
        const pathSource = "." + islandPath.replace(options.rootFolder, "");
        const islandContents = readFileSync(islandPath, { encoding: "utf-8" });

        let pathBundle = resolve(
          join(
            options.rootFolder,
            "public",
            ".islands",
            `${islandId}.bundle.js`,
          ),
        );
        pathBundle = `.${pathBundle.replace(options.rootFolder, "")}`;

        acc = {
          ...acc,
          [islandId]: {
            hash: createHash(HASH_ALGORITHM)
              .update(`${islandId}-${islandPath}-${islandContents}`)
              .digest("hex"),
            pathSource,
            pathBundle,
            pathSourceMap: `${pathBundle}.map`,
            res: Island,
          } as ManifestResource<ReactIsland>,
        };
        return acc;
      },
      {},
    );

    await bundleIslands(_islands, options);
  }

  await bundleRuntime(options);

  try {
    console.log("[ssr] Generating Manifest...");
    const manifestPath = resolve(join(options.rootFolder, "app.manifest.json"));
    const manifestStr = JSON.stringify(manifest, null, 2);

    try {
      const manifestStat = await stat(manifestPath);
      if (manifestStat.isFile()) {
        const currentManifestContents = await readFile(manifestPath, {
          encoding: "utf-8",
        });
        const { _generatedAtUnix: _, ...previousManifest } = JSON.parse(
          currentManifestContents,
        );
        const { _generatedAtUnix: __, ...currentManifest } = manifest;
        // compare stable values
        if (
          JSON.stringify(previousManifest) === JSON.stringify(currentManifest)
        ) {
          console.log("[ssr] Manifest did not change.");
          return manifest;
        }
      }
    } catch (_) {
      // Do nothing in case of errors, just write file.
    }

    await writeFile(manifestPath, [manifestStr, "\n"].join(""), {
      encoding: "utf-8",
    });
    console.log("[ssr] Manifest generated at:", manifestPath);
    return manifest as IManifest;
  } catch (err) {
    const error = err as Error;
    console.error("[ssr] Could not generate Manifest. Error:", error.message);
    return null;
  }
}
