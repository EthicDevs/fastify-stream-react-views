// std
import { join, resolve } from "path";
import { readFile } from "fs/promises";
// lib
import { IManifest, ReactIsland, ReactView } from "../types";

export default async function getManifestResources(
  rootFolder: string,
  manifestPath: string,
): Promise<{
  islandsById: {
    [islandId: string]: [string, ReactIsland<{}>];
  };
  viewsById: {
    [islandId: string]: [string, ReactView<{}>];
  };
}> {
  const manifestStr = await readFile(manifestPath, { encoding: "utf-8" });
  const currManifest = JSON.parse(manifestStr) as IManifest;

  const islandsById = await Object.entries(currManifest.islands).reduce(
    async (accP, [islandId, resource]) => {
      let acc = await accP;
      const resolvedResourcePath = resolve(
        join(rootFolder, resource.pathSource),
      );
      const nodeFile = await import(resolvedResourcePath);
      acc = {
        ...acc,
        [islandId]: [resource.pathSource, nodeFile.default as ReactIsland],
      };
      return acc;
    },
    Promise.resolve({} as { [islandId: string]: [string, ReactIsland] }),
  );

  const viewsById = await Object.entries(currManifest.views).reduce(
    async (accP, [viewId, resource]) => {
      let acc = await accP;
      const resolvedResourcePath = resolve(
        join(rootFolder, resource.pathSource),
      );
      const nodeFile = await import(resolvedResourcePath);
      acc = {
        ...acc,
        [viewId]: [resource.pathSource, nodeFile.default as ReactView],
      };
      return acc;
    },
    Promise.resolve({} as { [islandId: string]: [string, ReactView] }),
  );

  return {
    islandsById,
    viewsById,
  };
}
