import type { FC } from "react";
import { scanAsync as walkFolder } from "dree";

export async function walkFolderForFiles<R = FC<unknown>>(
  path: string,
): Promise<Record<string, [string, R]> | null> {
  try {
    const tree = await walkFolder(path, {
      depth: 5,
      extensions:
        process.env.NODE_ENV === "production" ? ["js"] : ["tsx", "jsx", "js"],
      normalize: true,
      followLinks: true,
      size: true,
      hash: true,
    });

    if (tree != null && tree.type === "directory" && tree.children != null) {
      let result = await tree.children.reduce(async (accP, node) => {
        let acc = await accP;
        const nodeKey =
          node.extension == null
            ? node.relativePath
            : node.relativePath.substring(
                0,
                // Strip extension length, +1 for dot
                node.relativePath.length - (node.extension.length + 1),
              );
        if (node.type === "directory") {
          acc = {
            ...acc,
            ...((await walkFolderForFiles(node.path)) as unknown as R),
          };
          return acc;
        }
        const nodeFile = await import(node.path);
        acc = { ...acc, [nodeKey]: [node.path, nodeFile.default as R] };
        return acc;
      }, Promise.resolve({} as Record<string, [string, R]>));

      return result;
    }

    return null;
  } catch (err) {
    console.error(
      `Could not walk folder for files. Error: ${(err as Error).message}`,
    );
    return null;
  }
}
