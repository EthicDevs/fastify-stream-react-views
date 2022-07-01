// std
import { writeFile } from "fs/promises";

// 3rd party
import type { PluginItem as BabelPluginItem } from "@babel/core";
import type { MinifyOutput } from "terser";

import { build as buildCode } from "esbuild";
import { minify as minifyCode } from "terser";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import { transformSync as transformCode } from "@babel/core";

const babelPlugins: BabelPluginItem[] = [
  [
    "@babel/plugin-transform-modules-umd",
    {
      globals: {
        "@ethicdevs/fastify-stream-react-views": "fastifyStreamReactViews",
        "markdown-to-jsx": "MarkdownToJSX",
        react: "React",
        "react-dom": "ReactDOM",
        "styled-components": "styled",
      },
    },
  ],
];

export async function bundleCode(options: {
  entryFile: string;
  globalName: string;
  minify?: boolean;
  outFolder: string;
  outFileName: string;
  withStyledSSR?: boolean;
  workingDirectory: string;
}) {
  if (options.withStyledSSR === true) {
    /* babelPlugins.push([
      "babel-plugin-styled-components",
      {
        minify: true,
        namespace: options.appName,
        pure: true,
        // else its gonna generate comments/newlines for rehydration, which we don't use
        ssr: false,
        transpileTemplateLiterals: true,
      },
    ]); */
  }

  const buildResults = await buildCode({
    entryPoints: {
      [options.outFileName]: options.entryFile,
    },
    outdir: options.outFolder,
    bundle: true,
    loader: { ".js": "jsx" },
    minify: false,
    minifyIdentifiers: false,
    metafile: true,
    target: "es6",
    absWorkingDir: options.workingDirectory,
    charset: "utf8",
    globalName: options.globalName,
    external: [
      "@ethicdevs/fastify-stream-react-views",
      "markdown-to-jsx",
      "react",
      "react-dom",
      "styled-components",
    ],
    jsx: "transform",
    keepNames: true,
    write: false,
    sourcemap: false,
    format: "esm",
    plugins: [nodeExternalsPlugin()],
  });

  const outputsEntries = Object.entries(buildResults.outputFiles!);
  await Promise.all(
    outputsEntries.map(async ([_, output]) => {
      try {
        const umdResult = transformCode(output.text, {
          moduleId: options.globalName,
          plugins: babelPlugins,
        });
        if (umdResult != null) {
          const code = umdResult.code != null ? umdResult.code : "";
          let minifiedCode: null | MinifyOutput;
          try {
            if (options.minify === true) {
              minifiedCode = await minifyCode(code, {
                sourceMap: true,
              });
            } else {
              minifiedCode = null;
            }
          } catch (_) {
            minifiedCode = null;
            // Do nothing, save un-minified code...
          }
          const minCode =
            minifiedCode != null ? minifiedCode.code || code : code;
          const smap = `${options.globalName}.bundle.js.map`;
          await writeFile(
            output.path,
            `/* ${options.globalName} */${minCode}${
              minifiedCode != null && minifiedCode.map != null
                ? `\n//# sourceMappingURL=${smap}`
                : ""
            }\n`,
            {
              encoding: "utf-8",
            },
          );
          if (minifiedCode != null && minifiedCode.map != null) {
            await writeFile(
              `${output.path}.map`,
              [minifiedCode.map.toString(), "\n"].join(""),
              {
                encoding: "utf-8",
              },
            );
          }
        }
      } catch (err) {
        const error = err as Error;
        console.error(
          `[ssr] Could not proceed file ${output.path}. Error:`,
          error.message,
        );
      }
    }),
  );
}
