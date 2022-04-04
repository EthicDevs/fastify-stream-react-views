// std
import path from "path";
import stream from "stream";

// 3rd party - fastify std
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// lib
import type {
  ReactView,
  StreamReactViewFunction,
  StreamReactViewPluginOptions,
  ViewContextBase,
} from "./types";
import {
  FASTIFY_VERSION_TARGET,
  HTML_DOCTYPE,
  HTML_MIME_TYPE,
} from "./constants";
import { requireView } from "./requireView";
import {
  buildViewWithProps,
  renderViewToStaticStream,
  renderViewToStream,
} from "./renderViewToStream";
import { isStyledComponentsAvailable } from "./styledComponentsTest";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    if (options?.views == null && options?.viewsFolder == null) {
      throw new Error(`You have not provided either a "views" config key or a "viewsFolder" config key.
Please verify your "views/" folder aswell as the "views" config key in your "fastify-stream-react-views" register config.`);
    }

    fastify.decorateReply("streamReactView", <StreamReactViewFunction>(
      function streamReactView(view, props, initialViewCtx) {
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
              titleStr = `${props.title} - ${titleStr}`;
            }

            // Write html/head tags
            endpointStream.write(
              `<html><head><title>${titleStr}</title></head><body>`,
            );

            const viewProps = {
              ...options?.commonProps,
              ...props,
              // \/ ensure last so its not overridden by props/commonProps
              viewCtx: <ViewContextBase>{
                headers: this.request.headers,
                ...initialViewCtx,
              },
            };

            let possibleReactViews: ReactView<unknown>[] = [];

            if (
              options?.views != null &&
              view in options.views === true &&
              options.views?.[view] != null
            ) {
              possibleReactViews.push(options.views[view]);
            }

            if (
              options?.viewsFolder != null &&
              options.viewsFolder.trim() !== ""
            ) {
              const reactView = await requireView(
                path.resolve(path.join(options.viewsFolder, view)),
              );
              possibleReactViews.push(reactView);
            }

            const reactView = possibleReactViews[0];
            if (reactView == null) {
              throw new Error(`Cannot find the requested view "${view}".
Please verify your "views/" folder aswell as the "views" config key in your "fastify-stream-react-views" register config.`);
            }

            const viewEl = buildViewWithProps(reactView, props);

            const onEndCallback = () => {
              const { viewCtx } = viewProps;

              if (viewCtx?.redirectUrl != null) {
                resolve(this.redirect(301, viewCtx.redirectUrl));
                if (endpointStream.readableEnded === false) {
                  endpointStream.end();
                }
                return;
              }

              this.status(viewCtx?.status || 200);
              resolve(this.send(endpointStream));

              if (endpointStream.readableEnded === false) {
                // Important, close the body & html tags.
                endpointStream.end("</body></html>");
              }
            };

            if (
              options?.withStyledSSR === true &&
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
  return fp(streamReactViewsPluginAsync, FASTIFY_VERSION_TARGET);
}
