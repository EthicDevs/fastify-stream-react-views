// std
import { join, resolve } from "path";
import stream from "stream";

// 3rd party - fastify std
import type { ComponentType } from "react";
import type { FastifyPluginAsync } from "fastify";
import { analyzeMetafile, build as buildCode } from "esbuild";
import makeFastifyPlugin from "fastify-plugin";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import ssrPrepass from "react-ssr-prepass";

// lib
import type {
  ReactIsland,
  ReactView,
  StreamReactViewFunction,
  StreamReactViewPluginOptions,
  ViewContext,
  ViewContextBase,
} from "./types";
import {
  FASTIFY_VERSION_TARGET,
  HTML_DOCTYPE,
  HTML_MIME_TYPE,
} from "./constants";
import { DefaultAppComponent } from "./components/DefaultAppComponent";
import { IslandsWrapper } from "./components/IslandsWrapper";
import {
  buildViewWithProps,
  getHeadTagsStr,
  getHtmlTagsStr,
  isStyledComponentsAvailable,
  renderViewToStaticStream,
  renderViewToStream,
  walkFolderForFiles,
  wrapIslandsWithComponent,
  wrapViewsWithApp,
} from "./helpers";

const NODE_ENV_STRICT =
  process.env.NODE_ENV === "production" ? "production" : "development";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    if (options?.views == null && options?.viewsFolder == null) {
      throw new Error(`You have not provided either a "views" config key or a "viewsFolder" config key.
Please verify your "views/" folder aswell as the "views" config key in your "fastify-stream-react-views" register config.`);
    }

    let viewsById: { [viewId: string]: ReactView } = {};
    let islandsById: { [islandId: string]: ReactIsland } = {};
    let islandsPropsById: { [islandId: string]: Record<string, unknown> } = {};

    if (options != null && options.viewsFolder != null) {
      const result = await walkFolderForFiles<ReactView>(options.viewsFolder);
      if (result != null) {
        viewsById = result;
        console.log("Found views:", viewsById);
      }
    }

    if (options != null && options.islandsFolder != null) {
      const result = await walkFolderForFiles<ReactIsland>(
        options.islandsFolder,
      );
      if (result != null) {
        islandsById = result;
        console.log("Found islands:", islandsById);

        /*const regeneratorRuntime = transformSync(
          readFileSync(
            "node_modules/regenerator-runtime/runtime.js",
          ).toString(),
          { minify: true, target: "es5" },
        ).code;*/

        await Promise.all(
          Object.entries(islandsById).map(async ([islandId]) => {
            console.log(`Bundling Island "${islandId}" for browser (esm) ...`);
            const buildResults = await buildCode({
              entryPoints: {
                [`${islandId}.bundle`]: resolve(
                  join(options.islandsFolder!, `${islandId}.tsx`),
                ),
              },
              outdir: resolve(join(options.rootFolder!, "public", ".islands")),
              bundle: true,
              loader: { ".js": "jsx" },
              minify: true,
              minifyIdentifiers: false,
              metafile: true,
              target: "es6",
              absWorkingDir: options.rootFolder,
              charset: "utf8",
              globalName: islandId,
              external: ["react", "react-dom", "styled-components"],
              jsx: "transform",
              keepNames: true,
              write: true,
              sourcemap: true,
              format: "esm",
              plugins: [nodeExternalsPlugin()],
              banner: {
                js: `var modules = {};`,
              },
              footer: {
                js: `(function (root, factory) {
                  if (typeof define === 'function' && define.amd) {
                    define(factory);
                  } else if (typeof module === 'object' && module.exports) {
                    module.exports = factory();
                  } else {
                    root.${islandId} = factory();
                  }
                }(typeof self !== 'undefined' ? self : this, () => ${islandId}));`,
              },
            });

            /*const outputsEntries = Object.entries(buildResults.outputFiles!);
            await Promise.all(
              outputsEntries.map(async ([outputPath, output]) => {
                const umdResult = transformCode(output.text, {
                  plugins: ["@babel/transform-modules-umd"],
                });
                if (umdResult != null) {
                  console.log("outputPath:", outputPath);
                  console.log("outputCode:", umdResult.code?.substring(0, 256));
                  await writeFile(
                    outputPath,
                    umdResult.code != null ? umdResult.code : "",
                    { encoding: "utf-8" },
                  );
                }
              }),
            );*/

            let bundleAnalysisText = await analyzeMetafile(
              buildResults.metafile,
              {
                verbose: true,
              },
            );

            console.log(
              `Bundled Island "${islandId}" for browser (esm) ! Results:`,
              bundleAnalysisText, // buildResults.outputFiles,
            );
          }),
        );
      }
    }

    if (options != null && options.views != null) {
      viewsById = { ...viewsById, ...options.views };
    }

    viewsById = wrapViewsWithApp(
      viewsById,
      options != null && options.appComponent != null
        ? options.appComponent
        : DefaultAppComponent,
    );

    islandsById = wrapIslandsWithComponent(islandsById, IslandsWrapper);

    fastify.decorateReply("streamReactView", <StreamReactViewFunction>(
      function streamReactView(view, props, viewCtx) {
        if (view in viewsById === false || viewsById[view] == null) {
          console.error(
            `Cannot find the requested view ${view} in views:`,
            viewsById,
          );
          throw new Error(`Cannot find the requested view "${view}".
        Please verify your "viewsFolder" configured folder aswell as the "views" config key in your "fastify-stream-react-views" register config.`);
        }

        let encounteredIslandsById: { [islandId: string]: ReactIsland } = {};

        return new Promise(async (resolve, reject) => {
          try {
            const endpointStream = new stream.PassThrough();

            // Set correct mime-type on the response
            this.type(HTML_MIME_TYPE);

            // pipe this stream into fastify's raw stream
            endpointStream.pipe(this.raw);

            // Write the html5 doctype
            endpointStream.write(HTML_DOCTYPE);

            let titleStr = options?.appName || "Fastify + React = ❤️";
            if (props != null && "title" in props && props.title != null) {
              titleStr = `${props.title} ${
                options?.titleSeparatorChar || "-"
              } ${titleStr}`;
            }

            const htmlTags = {
              ...(options?.viewContext?.html || {}),
              ...(viewCtx?.html || {}),
            };

            const headTags = [
              ...(options?.viewContext?.head || []),
              ...(viewCtx?.head || []),
            ];

            const htmlTagsStr = getHtmlTagsStr(htmlTags);
            const headTagsStr = getHeadTagsStr(headTags);

            // Write html/head tags
            endpointStream.write(
              `<html ${htmlTagsStr}><head><title>${titleStr}</title>${headTagsStr}</head><body>`,
            );

            const {
              head: _,
              html: __,
              ...baseViewCtx
            } = (options?.viewContext || {}) as ViewContext;

            const viewProps = {
              ...options?.commonProps,
              ...props,
              // \/ ensure last so its not overridden by props/commonProps
              _ssr: true,
              viewCtx: <ViewContextBase>{
                headers: this.request.headers,
                ...(baseViewCtx || {}),
                ...(viewCtx || {}),
              },
            };

            const reactView = viewsById[view];
            const viewEl = buildViewWithProps(reactView, viewProps);

            let islandTypesCounters: Record<string, number> = {};

            await ssrPrepass(viewEl, (element) => {
              const el = element as unknown as ComponentType & {
                type: string;
                key: string;
                props: {};
              };
              const island = Object.entries(islandsById).find(
                ([islandId]) =>
                  el.type != null &&
                  typeof el.type === "function" &&
                  islandId === (el.type as Function).name,
              );

              if (island) {
                const [islandId] = island;
                islandTypesCounters = {
                  ...islandTypesCounters,
                  [islandId]:
                    islandId in islandTypesCounters
                      ? islandTypesCounters[islandId] + 1
                      : 0,
                };
                let [_, IslandC] = island;
                encounteredIslandsById = {
                  ...encounteredIslandsById,
                  [islandId]: IslandC,
                };
                islandsPropsById = {
                  ...islandsPropsById,
                  [`${islandId}$$${islandTypesCounters[islandId]}`]: {
                    ...((element as any).props || {}),
                  },
                };
              }

              return undefined;
            });

            const onEndCallback = (err?: unknown) => {
              if (err != null) {
                const error = err as Error;
                console.error(`Cannot render view: "${view}". Error:\n`, error);
                endpointStream.end(
                  `<h1>${error.name}</h1><p>${error.message.replace(
                    "\n",
                    "<br />",
                  )}</p><pre style="max-width:100%;white-space:pre-wrap;"><code>${
                    error.stack
                  }</code></pre></body></html>`,
                );
                return resolve(this.send(endpointStream));
              }

              const { viewCtx } = viewProps;

              if (viewCtx != null) {
                if (viewCtx.redirectUrl != null) {
                  if (endpointStream.readableEnded === false) {
                    endpointStream.end();
                  }
                  return resolve(this.redirect(301, viewCtx.redirectUrl));
                }

                if (viewCtx.status != null) {
                  this.status(viewCtx.status);
                }
              }

              if (endpointStream.readableEnded === false) {
                // Inject Interactive components and their props.
                const encounteredIslandsEntries = Object.entries(
                  encounteredIslandsById,
                );
                // const islandsEntries = Object.entries(islandsById);
                const islandsPropsEntries = Object.entries(islandsPropsById);
                const fileForEnv =
                  NODE_ENV_STRICT === "production"
                    ? `production.min`
                    : `development`;
                const script: string = `
<script type="module" src="/public/.cdn/react.${fileForEnv}.js"></script>
<script type="module" src="/public/.cdn/react-is.${fileForEnv}.js"></script>
<script type="module" src="/public/.cdn/react-dom.${fileForEnv}.js"></script>
<script type="module" src="/public/.cdn/styled-components.production.min.js"></script>
<script type="module" src="/public/islands-runtime.js"></script>
${encounteredIslandsEntries
  .map(
    ([islandId]) =>
      `<script type="module" src="/public/.islands/${islandId}.bundle.js"></script>`,
  )
  .join("\n")}
<script type="module">
import {reviveIslands} from "/public/islands-runtime.js";

${encounteredIslandsEntries
  .map(
    ([islandId]) =>
      `  import ${islandId} from "/public/.islands/${islandId}.bundle.js"`,
  )
  .join(";\n")};

  const start = new Date().getTime();
  console.log(\`[\${start}] Reviving Islands for view "${view}"...\`);

  var islands = {
${encounteredIslandsEntries
  // .map(([k], islandIdx) => `    "${k}": $$${islandIdx}`)
  .map(([islandId]) => `    "${islandId}": ${islandId}`)
  .join(",\n")
  .replace(/react_[0-9]\.default/gi, "React")
  .replace(/react_[0-9]/gi, "React")}
  };

  var islandsProps = {
${islandsPropsEntries
  .map(([k, v]) => `    "${k}": ${JSON.stringify(v)}`)
  .join(",\n")},
  };

  function printDuration() {
    const end = new Date().getTime();
    console.log(\`[\${end}] Done in \${end - start}ms\`);
  }

  var islandsEls = document.querySelectorAll('[data-islandid]');

  reviveIslands(islands, islandsProps, islandsEls)
    .then((revivedIslands) => {
      console.log("Revived Islands:", revivedIslands);
      printDuration();
    })
    .catch((err) => {
      console.error("Could not revive Islands. Error:", err);
      printDuration();
    });
</script>
`;
                // Important, close the body & html tags.
                endpointStream.end(`${script}</body></html>`);
              }

              return resolve(this.send(endpointStream));
            };

            if (
              options != null &&
              options.withStyledSSR === true &&
              isStyledComponentsAvailable()
            ) {
              const { ServerStyleSheet } = require("styled-components");
              const sheet = new ServerStyleSheet();
              const jsx = sheet.collectStyles(viewEl);
              const reactViewWithStyledStream = sheet.interleaveWithNodeStream(
                renderViewToStream(jsx),
              );

              reactViewWithStyledStream.pipe(endpointStream, { end: false });
              reactViewWithStyledStream.on("error", onEndCallback);
              reactViewWithStyledStream.on("end", onEndCallback);
            } else {
              const reactViewStream: NodeJS.ReadableStream =
                renderViewToStaticStream(viewEl);

              reactViewStream.pipe(endpointStream, { end: false });
              reactViewStream.on("error", onEndCallback);
              reactViewStream.on("end", onEndCallback);
            }
          } catch (err) {
            console.log("Error in streamReactView:", (err as Error).message);
            reject(err);
          }
        });
      }
    ));
  };

export function makePlugin() {
  return makeFastifyPlugin(streamReactViewsPluginAsync, FASTIFY_VERSION_TARGET);
}
