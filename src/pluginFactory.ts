// std
import path from "path";

// 3rd party - fastify std
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

// lib
import { renderToStream } from "./renderToStream";

export interface StreamReactViewPluginOptions {
  /**
   * Path to React components to render as views (w/ ext. in /.j|tsx?/i)
   * @example
   * {
   *   // ... skip ...
   *   // assuming file at ./src/server.ext, views at ./src/views/*.ext
   *   viewsFolder: path.resolve(path.join(__dirname, './views'));
   * }
   */
  viewsFolder: string;
  /**
   * An object of common props passed to every View when rendered,
   * the properties does not needs to be serialisable, and thus functions can be
   * easily passed down the tree ;)
   * @note Props set directly in the reply.streamReactView() call will override
   * common props if both happens to specify the same key.
   */
  commonProps?: {
    [x: string]:
      | string
      | number
      | boolean
      | object
      | Array<string | number | boolean | object>
      | Function;
  };
}

const streamReactViewsPluginAsync: FastifyPluginAsync<StreamReactViewPluginOptions> =
  async (fastify, options) => {
    fastify.decorateReply(
      "streamReactView",
      function (view: string, props: { [x: string]: unknown }) {
        return renderToStream(
          path.resolve(path.join(options.viewsFolder, view)),
          { ...options?.commonProps, props },
        )
          .then((stream: NodeJS.ReadableStream) => {
            this.type("text/html");
            this.send(stream);
          })
          .catch((err: Error) => {
            console.error(
              "Error while generating React view=",
              view,
              "props=",
              props,
              "err=",
              err.message,
            );
            this.type("text/plain");
            this.send(err.message);
          });
      },
    );
  };

export function makePlugin() {
  return fp(streamReactViewsPluginAsync, "3.x");
}
