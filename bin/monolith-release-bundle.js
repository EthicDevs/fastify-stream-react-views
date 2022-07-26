#!/bin/env node
import { cwd } from "process";
import { join, resolve } from "path";

import generateManifest from "../dist/core/generateManifest";

async function main() {
  const rootFolder = cwd();

  console.log("rootFolder:", rootFolder);

  const manifest = await generateManifest({
    options: {
      rootFolder: resolve(rootFolder),
      distFolder: resolve(join(rootFolder, "dist")),
      islandsFolder: resolve(join(rootFolder, "app", "islands")),
      viewsFolder: resolve(join(rootFolder, "app", "views")),
      withStyledSSR: true,
    },
  });

  console.log("manifest:", manifest);
}

main();
