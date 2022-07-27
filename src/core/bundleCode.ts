// std
import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";

// 3rd party
import type { PluginItem as BabelPluginItem } from "@babel/core";
import type { MinifyOutput } from "terser";
import { build as buildCode } from "esbuild";
import { minify as minifyCode } from "terser";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import { transformSync as transformCode } from "@babel/core";
import { default as EsmExternals } from "@esbuild-plugins/esm-externals";

// lib
import { DefaultExternalDependencies } from "../constants";

export async function bundleCode(options: {
  externalDependencies?: Record<string, string>;
  entryFile: string;
  globalName: string;
  minify?: boolean;
  outFolder: string;
  outFileName: string;
  withStyledSSR?: boolean;
  workingDirectory: string;
}) {
  let externalDeps = {
    ...DefaultExternalDependencies,
    ...options.externalDependencies,
  } as Record<string, string>;

  // let externalDeps = {} as Record<string, string>;
  if (options.withStyledSSR === true) {
    externalDeps = {
      ...externalDeps,
      ["styled-components"]: "styled",
    };
  }

  const babelPlugins: BabelPluginItem[] = [
    ["@babel/plugin-transform-react-display-name"],
    [
      "@babel/plugin-transform-modules-umd",
      {
        globals: externalDeps,
      },
    ],
  ];

  // Ensure out directory exists first.
  try {
    // Needs to be sync to avoid race conditions.
    if (existsSync(options.outFolder) === false) {
      mkdirSync(options.outFolder, { recursive: true });
      console.log("[bundle] Created out folder at:", options.outFolder);
    }
  } catch (err) {
    console.error(
      "[bundle] Could not create islands folder. Error:",
      (err as Error).message,
    );
  }

  if (options.withStyledSSR === true) {
    /*babelPlugins.push([
      "babel-plugin-styled-components",
      {
        displayName: true,
        fileName: false,
        meaninglessFileNames: ["index", "styles"],
        minify: true,
        namespace: options.globalName,
        pure: true,
        // else its gonna generate comments/newlines for rehydration, which we don't use
        ssr: false,
        transpileTemplateLiterals: false,
      },
    ]);*/
  }

  const currEnv = process.env.NODE_ENV || "production";
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
    external: Object.keys(externalDeps),
    jsx: "transform",
    keepNames: true,
    write: false,
    sourcemap: false,
    format: "esm",
    plugins: [
      EsmExternals({ externals: Object.keys(externalDeps) }),
      nodeExternalsPlugin(),
    ],
    define: {
      "process.env.NODE_ENV": `"${currEnv}"`,
      __DEV__: currEnv === "production" ? `false` : `true`,
    },
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
