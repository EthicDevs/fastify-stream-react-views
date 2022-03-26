// std
import path from "path";
import stream from "stream";

// 3rd party - fastify std
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// lib
import type { StreamReactViewPluginOptions, ViewContextBase } from "./types";
import {
  FASTIFY_VERSION_TARGET,
  HTML_DOCTYPE,
  HTML_MIME_TYPE,
} from "./constants";
import { renderToStream } from "./renderToStream";

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    fastify.decorateReply(
      "streamReactView",
      function (view: string, props: { [x: string]: unknown }) {
        const endpointStream = new stream.PassThrough();

        this.type(HTML_MIME_TYPE);
        endpointStream.write(HTML_DOCTYPE);

        const viewCtx: ViewContextBase = {
          headers: this.request.headers,
        };

        const reactViewStream: NodeJS.ReadableStream = renderToStream(
          path.resolve(path.join(options.viewsFolder, view)),
          { ...options?.commonProps, props, viewCtx },
        );

        reactViewStream.pipe(endpointStream, { end: false });
        reactViewStream.on("end", () => {
          this.status(viewCtx?.status || 200);
          if (viewCtx?.redirectUrl != null) {
            this.redirect(301, viewCtx.redirectUrl);
            endpointStream.end();
            return;
          }
          this.send(endpointStream);
          endpointStream.end();
        });
      },
    );
  };

export function makePlugin() {
  return fp(streamReactViewsPluginAsync, FASTIFY_VERSION_TARGET);
}
