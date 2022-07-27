// std
import { readFile } from "fs/promises";
// lib
import { IManifest, ReactIsland, ReactView } from "../types";

export default async function getManifestResources(
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
      const nodeFile = await import(resource.pathSource);
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
      const nodeFile = await import(resource.pathSource);
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
