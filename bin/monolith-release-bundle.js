#!/usr/bin/env node

const { cwd } = require("process");
const { join, resolve } = require("path");

const generateManifest = require("../dist/core/generateManifest");

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
