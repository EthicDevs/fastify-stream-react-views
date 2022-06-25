// std
import { join, resolve } from "path";
import { writeFile } from "fs/promises";

// 3rd party
import { build as buildCode } from "esbuild";
import { minify as minifyCode, MinifyOutput } from "terser";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import { transformSync as transformCode } from "@babel/core";

// lib
import type { ReactIsland, StreamReactViewPluginOptions } from "../../types";

export default async function bundleIslands(
  islandsById: Record<string, [string, ReactIsland<{}>]>,
  options: StreamReactViewPluginOptions,
) {
  try {
    await Promise.all(
      Object.entries(islandsById).map(async ([islandId]) => {
        try {
          // console.log(`Bundling Island "${islandId}" for browser (esm) ...`);
          const buildResults = await buildCode({
            entryPoints: {
              [`${islandId}.bundle`]: resolve(
                join(options.islandsFolder, `${islandId}.tsx`),
              ),
            },
            outdir: resolve(join(options.rootFolder, "public", ".islands")),
            bundle: true,
            loader: { ".js": "jsx" },
            minify: false,
            minifyIdentifiers: false,
            metafile: true,
            target: "es6",
            absWorkingDir: options.rootFolder,
            charset: "utf8",
            globalName: islandId,
            external: ["react", "react-dom", "styled-components"],
            jsx: "transform",
            keepNames: true,
            write: false,
            sourcemap: false,
            format: "esm",
            plugins: [nodeExternalsPlugin()],
            banner: {
              js: `/* ${islandId} */ var modules = {};`,
            },
          });

          const outputsEntries = Object.entries(buildResults.outputFiles!);
          await Promise.all(
            outputsEntries.map(async ([_, output]) => {
              try {
                const umdResult = transformCode(output.text, {
                  moduleId: islandId,
                  plugins: [
                    [
                      "@babel/plugin-transform-modules-umd",
                      {
                        globals: {
                          react: "React",
                          "react-dom": "ReactDOM",
                          "styled-components": "styled",
                          "markdown-to-jsx": "MarkdownToJSX",
                        },
                      },
                    ],
                  ],
                });
                if (umdResult != null) {
                  const code = umdResult.code != null ? umdResult.code : "";
                  let minifiedCode: null | MinifyOutput;
                  try {
                    minifiedCode = await minifyCode(code, {
                      sourceMap: true,
                    });
                  } catch (_) {
                    minifiedCode = null;
                    // Do nothing, save un-minified code...
                  }
                  const minCode =
                    minifiedCode != null ? minifiedCode.code || code : code;
                  const smap = `${islandId}.bundle.js.map`;
                  await writeFile(
                    output.path,
                    `/* ${islandId} */${minCode}\n//# sourceMappingURL=${smap}`,
                    {
                      encoding: "utf-8",
                    },
                  );
                  if (minifiedCode != null && minifiedCode.map != null) {
                    await writeFile(
                      `${output.path}.map`,
                      minifiedCode.map.toString() || "",
                      {
                        encoding: "utf-8",
                      },
                    );
                  }
                }
              } catch (err) {
                const error = err as Error;
                console.error(
                  `Could not proceed file ${output.path}. Error:`,
                  error.message,
                );
              }
            }),
          );

          /*console.log(
            `Bundled Island "${islandId}" for browser (esm) !\n`,
            // bundleAnalysisText,
            buildResults.outputFiles
              .map((output) => `- ${output.path}`)
              .join("\n"),
          );*/
        } catch (err) {
          const error = err as Error;
          console.error(
            `Could not bundle island "${islandId}". Error:`,
            error.message,
          );
        }
      }),
    );
  } catch (err) {
    const error = err as Error;
    console.error("Could not bundle islands. Error:", error.message);
  }
}
