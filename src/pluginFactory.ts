// std
import stream from "stream";

// 3rd party - fastify std
import type { ComponentType } from "react";
import type { FastifyPluginAsync } from "fastify";

import makeFastifyPlugin from "fastify-plugin";
import ssrPrepass from "react-ssr-prepass";

// lib
import type {
  ReactIsland,
  ScriptTag,
  StreamReactViewFunction,
  StreamReactViewPluginOptions,
  ViewContext,
  ViewContextBase,
} from "./types";

import {
  FASTIFY_VERSION_TARGET,
  HTML_DOCTYPE,
  HTML_MIME_TYPE,
  NODE_ENV_STRICT,
} from "./constants";

import { InternalViewKind } from "./enums/InternalViewKind";
import { collectResources, generateManifest } from "./core";
import {
  buildViewWithProps,
  endStreamWithHtmlError,
  getHeadTagsStr,
  getHtmlTagsStr,
  getScriptTagsStr,
  isStyledComponentsAvailable,
  logRequestEnd,
  logRequestStart,
  makePageScript,
  renderViewToStaticStream,
  renderViewToStream,
  wrapViewsWithApp,
} from "./helpers";

import DefaultInternalErrorView from "./components/DefaultInternalErrorView";
import DefaultNotFoundErrorView from "./components/DefaultNotFoundErrorView";
import { DefaultAppComponent } from "./components/DefaultAppComponent";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    // Walk folders specified in options (islandsFolder, viewsFolder)
    // and collect resources.
    let { islandsById, viewsById } = await collectResources(options);

    // Get App component either from user override or from default component.
    const AppComponent =
      options != null && options.appComponent != null
        ? options.appComponent
        : DefaultAppComponent;

    // Add internal views so user can override only if needed.
    const defaultViewsById = wrapViewsWithApp(
      {
        [InternalViewKind.INTERNAL_ERROR_VIEW]: [
          InternalViewKind.INTERNAL_ERROR_VIEW,
          DefaultInternalErrorView as never,
        ],
        [InternalViewKind.NOT_FOUND_ERROR_VIEW]: [
          InternalViewKind.NOT_FOUND_ERROR_VIEW,
          DefaultNotFoundErrorView,
        ],
      },
      AppComponent,
    );

    // Make sure viewsById is at the end so user overrides take effect.
    viewsById = {
      ...defaultViewsById,
      ...viewsById,
    };

    // Generate and write manifest in rootFolder.
    const manifest = await generateManifest({
      islands: islandsById,
      views: viewsById,
      options,
    });

    if (manifest == null) {
      console.error("Could not generate manifest. Something went wrong. ^");
    }

    // Decorate the fastify.reply method with a new reply function "streamReactView"
    fastify.decorateReply("streamReactView", <StreamReactViewFunction>(
      function streamReactView(view, props, viewCtx) {
        return new Promise(async (resolve, reject) => {
          const reqStartAtUnix = logRequestStart(this.request, view);

          try {
            const endpointStream = new stream.PassThrough();

            let encounteredIslandsById: Record<string, ReactIsland> = {};
            let islandsCountsById: Record<string, number> = {};
            let islandsPropsById: Record<string, Record<string, unknown>> = {};

            // Set correct mime-type on the response
            this.type(HTML_MIME_TYPE);

            // pipe this stream into fastify's raw stream
            endpointStream.pipe(this.raw);

            // Write the html5 doctype
            endpointStream.write(HTML_DOCTYPE);

            if (view in viewsById === false || viewsById[view] == null) {
              let errorMessage = [] as string[];
              errorMessage.push(`Cannot find the requested view "${view}".`);
              errorMessage.push(`Please check your usage of "viewsFolder".`);
              errorMessage.push(
                `Make sure that a file for view "${view}" exists and it exports default a 'ReactView' type.`,
              );
              const error = new Error(errorMessage.join("\n"));
              error.name = InternalViewKind.INTERNAL_ERROR_VIEW;
              view = error.name;
              if (!props) {
                props = {};
              }
              props.title = error.name;
              props.error = error;
              // await endStreamWithHtmlError(
              //   endpointStream,
              //   error,
              //   options.rootFolder,
              // );
              // logRequestEnd(reqStartAtUnix, this.request, view, error);
              // return resolve(this.send(endpointStream));
            }

            // Get the page title (for use in <title> tag)
            let titleStr = options?.appName || null;
            if (props != null && "title" in props && props.title != null) {
              titleStr = `${props.title}${
                titleStr != null
                  ? ` ${options?.titleSeparatorChar || " - "} `
                  : ""
              }${titleStr}`;
            }

            // Prepare HTML/Head tags
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

            // Write HTML/Head tags
            endpointStream.write(
              `<html ${htmlTagsStr}><head><title>${titleStr}</title>${headTagsStr}</head><body>`,
            );

            // Prepare view context (to pass data around)
            const {
              head: _, // remove from baseViewCtx
              html: __, // remove from baseViewCtx
              ...baseViewCtx
            } = options != null && options.viewContext != null
              ? options.viewContext
              : ({} as ViewContext);

            // Prepare view props
            const viewProps = {
              ...(options != null && options.commonProps != null
                ? options.commonProps
                : {}),
              ...props,
              // \/ ensure last so its not overridden by props/commonProps
              _ssr: true,
              viewCtx: <ViewContextBase>{
                headers: this.request.headers,
                ...(baseViewCtx || {}),
                ...(viewCtx || {}),
              },
            };

            // Build view with props
            const [___, reactView] = viewsById[view];
            const viewEl = buildViewWithProps(reactView, viewProps);

            // Visit tree to find all the islands and collect their props
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
                const [islandId, [__, IslandC]] = island;
                encounteredIslandsById = {
                  ...encounteredIslandsById,
                  [islandId]: IslandC,
                };
                islandsCountsById = {
                  ...islandsCountsById,
                  [islandId]:
                    islandId in islandsCountsById
                      ? islandsCountsById[islandId] + 1
                      : 0,
                };
                islandsPropsById = {
                  ...islandsPropsById,
                  [`${islandId}$$${islandsCountsById[islandId]}`]: {
                    ...((element as any).props || {}),
                  },
                };
              }
              return undefined;
            });

            // Prepare callback for when page generation is done
            const onEndCallback = async (err?: unknown) => {
              if (err != null) {
                const error = err as Error;
                await endStreamWithHtmlError(
                  endpointStream,
                  error,
                  options.rootFolder,
                );
                logRequestEnd(reqStartAtUnix, this.request, view, error);
                return resolve(this.send(endpointStream));
              }

              const { viewCtx } = viewProps;

              // if the view changed the viewCtx during first render
              if (viewCtx != null) {
                // if the view wants to redirect
                if (viewCtx.redirectUrl != null) {
                  if (endpointStream.readableEnded === false) {
                    endpointStream.end();
                  }
                  logRequestEnd(reqStartAtUnix, this.request, view);
                  return resolve(this.redirect(301, viewCtx.redirectUrl));
                }
                // if the view wants a custom HTTP status code
                if (viewCtx.status != null) {
                  this.status(viewCtx.status);
                }
              }

              if (endpointStream.readableEnded === false) {
                const pageScript = await makePageScript(view, {
                  encounteredIslandsById,
                  islandsPropsById,
                });

                const scriptFileByEnv =
                  NODE_ENV_STRICT === "production"
                    ? `production.min`
                    : `development`;

                const isPageContainingIslands = !!(
                  Object.keys(encounteredIslandsById).length >= 1
                );

                const scriptsType = "module";

                // TODO(config): make these paths more configurable
                const externalDepsScriptTags: ScriptTag[] =
                  options.externalDependencies != null
                    ? Object.entries(options.externalDependencies).map(
                        ([_, fileName]): ScriptTag => ({
                          type: scriptsType,
                          src: `/public/.cdn/${fileName}.${scriptFileByEnv}.js`,
                        }),
                      )
                    : [
                        {
                          type: scriptsType,
                          src: `/public/.cdn/react.${scriptFileByEnv}.js`,
                        },
                        {
                          type: scriptsType,
                          src: `/public/.cdn/react-is.${scriptFileByEnv}.js`,
                        },
                        {
                          type: scriptsType,
                          src: `/public/.cdn/react-dom.${scriptFileByEnv}.js`,
                        },
                        {
                          type: scriptsType,
                          src: `/public/.cdn/styled-components.production.min.js`,
                        },
                      ];

                const islandsScriptTags: ScriptTag[] = Object.entries(
                  encounteredIslandsById,
                ).map(
                  ([islandId]): ScriptTag => ({
                    type: scriptsType,
                    src: `/public/.islands/${islandId}.bundle.js`,
                  }),
                );

                const scriptTags: ScriptTag[] = [
                  ...externalDepsScriptTags,
                  {
                    type: scriptsType,
                    src: `/public/islands-runtime.js`,
                  },
                  ...islandsScriptTags,
                  {
                    type: scriptsType,
                    textContent: pageScript,
                  },
                ];

                const scriptTagsStr = getScriptTagsStr(scriptTags);

                // Only send if page has islands we've been able to find
                if (isPageContainingIslands) {
                  endpointStream.end(
                    `${scriptTagsStr}</body></html>`.replace(/[\n\r]+/g, ""),
                  );
                } else {
                  // Important, close the body & html tags.
                  endpointStream.end(`</body></html>`);
                }
              }

              logRequestEnd(reqStartAtUnix, this.request, view);
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
