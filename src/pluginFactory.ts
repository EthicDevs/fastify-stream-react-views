// std
import stream from "stream";

// 3rd party - fastify std
import type { ComponentType } from "react";
import type { FastifyPluginAsync } from "fastify";

import makeFastifyPlugin from "fastify-plugin";
import { MinifyOutput, minify as minifyCode } from "terser";
import ssrPrepass from "react-ssr-prepass";

// lib
import type {
  ReactIsland,
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
  wrapIslandsWithComponent,
  wrapViewsWithApp,
} from "./helpers";

import { collectResources, generateManifest } from "./core";

const NODE_ENV_STRICT =
  process.env.NODE_ENV === "production" ? "production" : "development";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    let islandsPropsById: { [islandId: string]: Record<string, unknown> } = {};
    let { islandsById, viewsById } = await collectResources(options);
    const manifest = await generateManifest({
      islands: islandsById,
      options,
      views: viewsById,
    });

    if (manifest == null) {
      console.error("Could not generate manifest. Something went wrong.");
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

            let titleStr = options?.appName || null;
            if (props != null && "title" in props && props.title != null) {
              titleStr = `${props.title}${
                titleStr != null
                  ? ` ${options?.titleSeparatorChar || " - "} `
                  : ""
              }${titleStr}`;
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

            const [___, reactView] = viewsById[view];
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
                let [_, [__, IslandC]] = island;
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

            const onEndCallback = async (err?: unknown) => {
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
import {reviveIslands} from "/public/islands-runtime.js";

const start = new Date().getTime();
console.log(\`[\${start}] Reviving Islands for view "${view}"...\`);

var islands = {
${encounteredIslandsEntries
  // .map(([k], islandIdx) => `    "${k}": $$${islandIdx}`)
  .map(([islandId]) => `  "${islandId}": ${islandId}.default`)
  .join(",\n")
  .replace(/react_[0-9]\.default/gi, "React")
  .replace(/react_[0-9]/gi, "React")}
};

var islandsProps = {
${islandsPropsEntries
  .map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`)
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
`;
                // Important, close the body & html tags.
                let minifiedCode: null | MinifyOutput = null;
                try {
                  minifiedCode = await minifyCode(script);
                } catch (_) {
                  minifiedCode = null;
                }
                let minifiedScript =
                  minifiedCode != null ? minifiedCode.code || script : script;

                // Only send if page has islands we've been able to find
                if (encounteredIslandsEntries.length > 0) {
                  endpointStream.end(
                    `<script type="module" src="/public/.cdn/react.${fileForEnv}.js"></script>
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
<script type="module">${minifiedScript}</script></body></html>`.replace(
                      /[\n\r]+/g,
                      "",
                    ),
                  );
                } else {
                  endpointStream.end(`</body></html>`);
                }
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
