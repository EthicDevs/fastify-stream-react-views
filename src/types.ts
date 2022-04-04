import { FastifyReply } from "fastify";
import type { IncomingHttpHeaders } from "node:http";
import { VFC } from "react";

export interface CommonPropsBase {
  [x: string]:
    | string
    | number
    | boolean
    | object
    | Array<string | number | boolean | object>
    | Function;
}

export interface StreamReactViewPluginOptions<
  C extends CommonPropsBase = CommonPropsBase,
> {
  /**
   * Defaut tab page title
   */
  appName?: string;
  /**
   * An hashmap of routes, this is the preferred way to use this module main because
   * the `viewsFolder` option relies on import/require wizardry.
   */
  views?: Record<string, React.VFC>;
  /**
   * Path to React components to render as views (w/ ext. in /.j|tsx?/i)
   * @example
   * {
   *   // ... skip ...
   *   // assuming file at ./src/server.ext, views at ./src/views/*.ext
   *   viewsFolder: path.resolve(path.join(__dirname, './views'));
   * }
   */
  viewsFolder?: string;
  /**
   * An object of common props passed to every View when rendered,
   * the properties does not needs to be serialisable, and thus functions can be
   * easily passed down the tree ;)
   * @note Props set directly in the reply.streamReactView() call will override
   * common props if both happens to specify the same key.
   */
  commonProps?: C;
  /**
   * Enable/Disable supports for styled-components ssr
   */
  withStyledSSR?: boolean;
}

export interface ViewContextBase {
  [x: string]: unknown;
  headers: IncomingHttpHeaders;
  status?: number;
  redirectUrl?: string;
}

export type StreamReactViewFunction = (
  this: FastifyReply,
  view: string,
  props?: Record<string, unknown>,
  initialViewCtx?: Record<string, unknown>,
) => Promise<FastifyReply>;

export type ReactView<P> = VFC<
  P & {
    ssr: boolean;
  }
>;
