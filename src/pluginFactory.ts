// std
import path from "path";
import stream from "stream";

// 3rd party - fastify std
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// lib
import type {
  StreamReactViewFunction,
  StreamReactViewPluginOptions,
  ViewContextBase,
} from "./types";
import {
  FASTIFY_VERSION_TARGET,
  HTML_DOCTYPE,
  HTML_MIME_TYPE,
} from "./constants";
import { renderToStream } from "./renderToStream";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    fastify.decorateReply("streamReactView", <StreamReactViewFunction>(
      function streamReactView(view, props, initialViewCtx) {
        return new Promise((resolve) => {
          const endpointStream = new stream.PassThrough();

          this.type(HTML_MIME_TYPE);
          endpointStream.write(HTML_DOCTYPE);

          const viewProps = {
            ...options?.commonProps,
            ...props,
            // \/ ensure last so its not overridden by props/commonProps
            viewCtx: <ViewContextBase>{
              headers: this.request.headers,
              ...initialViewCtx,
            },
          };

          const reactViewStream: NodeJS.ReadableStream = renderToStream(
            path.resolve(path.join(options.viewsFolder, view)),
            viewProps,
          );

          reactViewStream.pipe(endpointStream, { end: false });
          reactViewStream.on("end", () => {
            const { viewCtx } = viewProps;

            if (viewCtx?.redirectUrl != null) {
              this.redirect(301, viewCtx.redirectUrl);
              endpointStream.end();
              return;
            }

            this.status(viewCtx?.status || 200);
            this.send(endpointStream);

            if (endpointStream.readableEnded === false) {
              endpointStream.end();
            }
          });

          resolve(reactViewStream);
        });
      }
    ));
  };

export function makePlugin() {
  return fp(streamReactViewsPluginAsync, FASTIFY_VERSION_TARGET);
}
