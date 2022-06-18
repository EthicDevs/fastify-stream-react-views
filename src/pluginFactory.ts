// std
import stream from "stream";

// 3rd party - fastify std
import type { FastifyPluginAsync } from "fastify";
import makeFastifyPlugin from "fastify-plugin";
import { scanAsync as walkFolder } from "dree";

// lib
import type {
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
import {
  buildViewWithProps,
  renderViewToStaticStream,
  renderViewToStream,
} from "./renderViewToStream";
import { getHeadTagsStr, getHtmlTagsStr, wrapViewsWithApp } from "./helpers";
import { isStyledComponentsAvailable } from "./styledComponentsTest";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    if (options?.views == null && options?.viewsFolder == null) {
      throw new Error(`You have not provided either a "views" config key or a "viewsFolder" config key.
Please verify your "views/" folder aswell as the "views" config key in your "fastify-stream-react-views" register config.`);
    }

    let viewsByName: Record<string, ReactView> = {};

    if (options != null && options.viewsFolder != null) {
      const tree = await walkFolder(options.viewsFolder, {
        depth: 5,
        extensions: ["jsx", "tsx"],
        normalize: true,
        followLinks: true,
        size: true,
        hash: true,
      });

      if (tree != null && tree.type === "directory" && tree.children != null) {
        viewsByName = await tree.children.reduce(async (accP, node) => {
          let acc = await accP;
          const nodeFile = await import(node.path);
          const nodeKey =
            node.extension == null
              ? node.relativePath
              : node.relativePath.substring(
                  0,
                  // Strip extension length, +1 for dot
                  node.relativePath.length - (node.extension.length + 1),
                );
          acc = { ...acc, [nodeKey]: nodeFile.default as ReactView };
          return acc;
        }, Promise.resolve({} as typeof viewsByName));
      }
    }

    if (options != null && options.views != null) {
      viewsByName = { ...viewsByName, ...options.views };
    }

    viewsByName = wrapViewsWithApp(
      viewsByName,
      options != null && options.appComponent != null
        ? options.appComponent
        : DefaultAppComponent,
    );

    fastify.decorateReply("streamReactView", <StreamReactViewFunction>(
      function streamReactView(view, props, viewCtx) {
        if (view in viewsByName === false || viewsByName[view] == null) {
          console.error(
            `Cannot find the requested view ${view} in views:`,
            viewsByName,
          );
          throw new Error(`Cannot find the requested view "${view}".
        Please verify your "viewsFolder" configured folder aswell as the "views" config key in your "fastify-stream-react-views" register config.`);
        }

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

            const reactView = viewsByName[view];
            const viewEl = buildViewWithProps(reactView, viewProps);

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
                // Important, close the body & html tags.
                endpointStream.end(`</body></html>`);
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
