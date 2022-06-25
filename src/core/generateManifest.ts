// std
import { createHash } from "crypto";
import { join, resolve } from "path";
import { writeFile } from "fs/promises";

// lib
import type {
  ReactIsland,
  ReactView,
  StreamReactViewPluginOptions,
} from "../types";

import { walkFolderForFiles } from "../helpers";
import bundleIslands from "./islands/bundleIslands";

type ManifestResource<
  B extends ReactView | ReactIsland = ReactView | ReactIsland,
> = {
  hash: string;
  id: string;
  pathSource: string;
  pathBundle?: string;
  res: B;
  type: "Asset" | "ReactView" | "ReactIsland";
};

interface IManifest {
  _generatedAtUnix: number;
  _hashAlgorithm: string;
  _version: 1;
  views: {
    [viewId: string]: ManifestResource<ReactView>;
  };
  islands: {
    [islandId: string]: ManifestResource<ReactIsland>;
  };
}

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
    _version: 1,
    islands: {},
    views: {},
  };

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
        acc = {
          ...acc,
          [viewId]: {
            hash: createHash(HASH_ALGORITHM)
              .update(`${viewId}-${viewPath}-${View.toString()}`)
              .digest("hex"),
            id: viewId,
            pathSource: viewPath.replace(options.rootFolder, ""),
            res: View,
            type: "ReactView",
          },
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
        acc = {
          ...acc,
          [islandId]: {
            hash: createHash(HASH_ALGORITHM)
              .update(`${islandId}-${islandPath}-${Island.toString()}`)
              .digest("hex"),
            id: islandId,
            pathSource: islandPath.replace(options.rootFolder, ""),
            pathBundle: resolve(
              join(
                options.rootFolder,
                "public",
                ".islands",
                `${islandId}.bundle.js`,
              ),
            ).replace(options.rootFolder, ""),
            res: Island,
            type: "ReactIsland",
          },
        };
        return acc;
      },
      {},
    );
    await bundleIslands(_islands, options);
  }

  try {
    console.log("[ssr] Generating Manifest...");
    const manifestPath = resolve(join(options.distFolder, "manifest.json"));
    const manifestStr = JSON.stringify(manifest, null, 2);
    await writeFile(manifestPath, manifestStr, { encoding: "utf-8" });
    console.log("[ssr] Manifest generated at:", manifestPath);
    return manifest;
  } catch (err) {
    const error = err as Error;
    console.error("[ssr] Could not generate Manifest. Error:", error.message);
    return null;
  }
}
