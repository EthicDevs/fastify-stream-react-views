// std
import stream from "stream";
import { join, resolve } from "path";
// 3rd party - fastify std
import type { ComponentType } from "react";
import type { FastifyPluginAsync } from "fastify";
import makeFastifyPlugin from "fastify-plugin";
import ssrPrepass from "react-ssr-prepass";
// lib
import type {
  IslandsWrappedWithComponent,
  ReactIsland,
  ScriptTag,
  StreamReactViewFunction,
  StreamReactViewPluginOptions,
  ViewContext,
  ViewContextBase,
  ViewsWrappedWithApp,
} from "./types";

import {
  FASTIFY_VERSION_TARGET,
  HTML_DOCTYPE,
  HTML_MIME_TYPE,
  NODE_ENV_STRICT,
  DefaultExternalDependencies,
} from "./constants";

import { InternalViewKind } from "./enums/InternalViewKind";
import {
  collectAndWrapResources,
  generateManifest,
  getManifestResources,
  makePageScript,
} from "./core";
import {
  buildViewWithProps,
  endStreamWithHtmlError,
  getHeadTagsStr,
  getHtmlTagsStr,
  getImportsMapScriptTagStr,
  getScriptTagsStr,
  isStyledComponentsAvailable,
  logRequestEnd,
  logRequestStart,
  renderViewToStaticStream,
  renderViewToStream,
  wrapViewsWithApp,
} from "./helpers";

import DefaultInternalErrorView from "./components/DefaultInternalErrorView";
import DefaultNotFoundErrorView from "./components/DefaultNotFoundErrorView";
import { DefaultAppComponent } from "./components/DefaultAppComponent";
import { removeCommentsAndSpacing } from "./helpers/removeCommentsAndSpacing";
import { reduceDuplicates } from "./helpers/reduceDuplicates";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    let resources: {
      islandsById: IslandsWrappedWithComponent<{}>;
      viewsById: ViewsWrappedWithApp<{}>;
    } = {
      islandsById: {},
      viewsById: {},
    };

    try {
      if (process.env.NODE_ENV === "production") {
        const manifestPath = resolve(
          join(options.rootFolder, "app.manifest.json"),
        );
        const manifestResources = await getManifestResources(
          options.rootFolder,
          manifestPath,
        );
        resources = await collectAndWrapResources(options, manifestResources);
      } else {
        resources = await collectAndWrapResources(options);
        await generateManifest({
          islands: resources.islandsById,
          views: resources.viewsById,
          options,
        });
      }
    } catch (err) {
      const errMessage = (err as Error).message;
      console.error(
        process.env.NODE_ENV === "development"
          ? `Could not generate/write app.manifest.json file. Error: ${errMessage}`
          : `Could not read/parse app.manifest.json file. Error: ${errMessage}`,
      );
      process.exit(1);
    }

    if (Object.keys(resources.islandsById).length <= 0) {
      console.warn("Found no Islands.");
    }
    if (Object.keys(resources.viewsById).length <= 0) {
      console.warn("Found no Views.");
    }

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

    let { islandsById, viewsById } = resources;

    // Make sure viewsById is at the end so user overrides take effect.
    viewsById = {
      ...defaultViewsById,
      ...viewsById,
    };

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

            const headTags = reduceDuplicates(
              [...(options?.viewContext?.head || []), ...(viewCtx?.head || [])],
              (a, b) => JSON.stringify(a) === JSON.stringify(b),
            );

            const baseScriptTags = reduceDuplicates(
              [
                ...(options?.viewContext?.scripts || []),
                ...(viewCtx?.scripts || []),
              ],
              (a, b) => JSON.stringify(a) === JSON.stringify(b),
            );

            const htmlTagsStr = getHtmlTagsStr(htmlTags);
            const headTagsStr = getHeadTagsStr(headTags);

            // Write HTML/Head tags
            endpointStream.write(
              `<html ${htmlTagsStr}><head><title>${titleStr}</title>${removeCommentsAndSpacing(
                headTagsStr,
              )}</head><body>`,
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
                // TODO(config): expose this to the config
                const scriptFileByEnv =
                  NODE_ENV_STRICT === "production"
                    ? `production.min`
                    : `development`;

                const isPageContainingIslands = !!(
                  Object.keys(encounteredIslandsById).length >= 1
                );

                const scriptsType = "module";

                let externalDeps = {
                  ...DefaultExternalDependencies,
                  ...(options?.externalDependencies || {}),
                } as Record<string, string>;

                if (options.withStyledSSR === true) {
                  externalDeps = {
                    ...externalDeps,
                    ["styled-components"]: "styled",
                  };
                }

                const assetImportPrefix =
                  options?.assetImportPrefix || `/public`;
                const assetDepsFolder = options?.assetDepsFolder || ".cdn";

                // TODO(config): make this configurable
                const externalDepsScriptTags: (Omit<ScriptTag, "id" | "src"> & {
                  id: string;
                  moduleName: string;
                  src: string;
                })[] = Object.entries(externalDeps).map(
                  ([fileName, moduleName]): Omit<ScriptTag, "id" | "src"> & {
                    id: string;
                    moduleName: string;
                    src: string;
                  } => ({
                    id: moduleName,
                    type: scriptsType,
                    moduleName: fileName,
                    src: `${assetImportPrefix}/${assetDepsFolder}/${fileName}.${scriptFileByEnv}.js`,
                  }),
                );

                const importsMapScriptTagStr =
                  options.withImportsMap === true
                    ? getImportsMapScriptTagStr(externalDepsScriptTags)
                    : "";

                const islandsScriptTags: ScriptTag[] = Object.entries(
                  encounteredIslandsById,
                ).map(
                  ([islandId]): ScriptTag => ({
                    id: islandId,
                    type: scriptsType,
                    src: `${assetImportPrefix}/.islands/${islandId}.bundle.js`,
                  }),
                );

                const pageScript = await makePageScript(view, {
                  encounteredIslandsById,
                  islandsPropsById,
                  islandsScriptTags,
                  useEsImports: options.withImportsMap === true,
                  importsMap: externalDepsScriptTags,
                });

                const scriptTags: ScriptTag[] = reduceDuplicates(
                  [
                    ...baseScriptTags,
                    // when true, external dependencies are provided through the
                    // script of type `importmap` (see `importsMapScriptTagStr`)
                    ...(options.withImportsMap === false
                      ? (externalDepsScriptTags as ScriptTag[])
                      : []),
                    {
                      type: scriptsType,
                      src: `${assetImportPrefix}/islands-runtime.js`,
                    },
                    // when true, islands are imported in the pageScript as ES imports.
                    ...(options.withImportsMap === false
                      ? islandsScriptTags
                      : []),
                    {
                      type: scriptsType,
                      textContent: pageScript,
                    },
                  ],
                  (a, b) => JSON.stringify(a) === JSON.stringify(b),
                );

                const scriptTagsStr = getScriptTagsStr(scriptTags);
                const bodyEndStr =
                  options.withImportsMap === true
                    ? `${importsMapScriptTagStr}${scriptTagsStr}`
                    : `${scriptTagsStr}`;

                // Only send if page has islands we've been able to find
                if (isPageContainingIslands) {
                  endpointStream.end(
                    process.env.NODE_ENV === "production"
                      ? removeCommentsAndSpacing(`${bodyEndStr}</body></html>`)
                      : `${bodyEndStr}</body></html>`,
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
