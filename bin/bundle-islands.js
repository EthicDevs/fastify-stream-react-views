#!/usr/bin/env node --experimental-import-meta-resolve

const { cwd } = require("process");
const { join, resolve } = require("path");
const { writeFile } = require("fs/promises");

const { generateManifest } = require("../dist");

async function bundleIslands() {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(
      `Please call this script only when NODE_ENV=production is set.`,
    );
  }

  const rootFolder = cwd();
  const paths = require(resolve(join(rootFolder, "dist", "paths.js")));
  const manifestPath = resolve(join(paths.ROOT_FOLDER, "app.manifest.json"));

  console.log("rootFolder:", rootFolder);

  const manifest = await generateManifest({
    options: {
      rootFolder: paths.ROOT_FOLDER,
      assetDepsFolder: paths.ASSET_DEPS_FOLDER_NAME,
      assetsOutFolder: paths.PUBLIC_FOLDER,
      distFolder: paths.DIST_FOLDER,
      islandsFolder: paths.ISLANDS_FOLDER,
      viewsFolder: paths.VIEWS_FOLDER,
      withStyledSSR: true,
    },
  });

  const nextManifestText = `${JSON.stringify(manifest, null, 2)}\n`;

  await writeFile(manifestPath, nextManifestText, { encoding: "utf-8" });

  console.log("Built manifest:", nextManifestText);
}

bundleIslands();
