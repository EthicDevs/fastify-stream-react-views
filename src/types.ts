import { FastifyReply } from "fastify";
import type { IncomingHttpHeaders } from "node:http";
import { VFC } from "react";

export type ViewContext = {
  [x: string]: unknown;
  head?: HeadTag[];
  html?: {
    lang?: string;
    dir?: string;
  };
};

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
  CP extends CommonPropsBase = CommonPropsBase,
  VC extends ViewContext = ViewContext,
> {
  /**
   * App component, wraps every view. Useful for things that are shared around
   * views, for setting context providers up, or to catch errors (w/ errors boundary).
   * Defaults to using the `DefaultAppComponent` (an empty fragment wrapping its
   * children) when it is not provided.
   */
  appComponent?: React.FC;
  /**
   * Defaut tab page title
   */
  appName?: string;
  /**
   * An object of common props passed to every View when rendered,
   * the properties does not needs to be serialisable, and thus functions can be
   * easily passed down the tree ;)
   * @note Props set directly in the reply.streamReactView() call will override
   * common props if both happens to specify the same key.
   */
  commonProps?: CP;
  /**
   * Path to React components to render as islands (w/ ext. jsx or tsx).
   *
   * Islands are regular components that get "revived" on the client once SSR
   * has been received by the client. It allows for self-contained area of
   * interactivity within a server-side rendered view, on the client side.
   *
   * @example
   * {
   *   // ... skip ...
   *   // assuming file at ./src/server.ext, islands at ./src/islands/*.ext
   *   islandsFolder: path.resolve(path.join(__dirname, './islands'));
   * }
   */
  islandsFolder?: string;
  /**
   * Title bar separator character (`${pageTitle} ${titleSeparatorChar} ${appName}`)
   * defaults to: `-`, other cool values includes: `∙`
   **/
  titleSeparatorChar?: string;
  /**
   * An hashmap of routes, this is the preferred way to use this module main because
   * the `viewsFolder` option relies on import/require wizardry.
   */
  views?: Record<string, React.VFC>;
  /**
   * Path to React components to render as views (w/ ext. jsx or tsx).
   *
   * View are regular HTML pages made-up of server-side rendered React components.
   *
   * @example
   * {
   *   // ... skip ...
   *   // assuming file at ./src/server.ext, views at ./src/views/*.ext
   *   viewsFolder: path.resolve(path.join(__dirname, './views'));
   * }
   */
  viewsFolder?: string;
  /**
   * An object to be merged later with view context.
   */
  viewContext?: VC;
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

export type HeadTagMeta = {
  kind: "meta";
  name: string;
  content: string;
};

export type HeadTagMetaCharset = {
  kind: "meta";
  charset: string;
};

export type HeadTagLink = {
  kind: "link";
  rel: string;
  href: string;
  hreflang?: string;
  title?: string;
  type?: string;
};

export type HeadTag = HeadTagMeta | HeadTagMetaCharset | HeadTagLink;

export type StreamReactViewFunction = (
  this: FastifyReply,
  view: string,
  props?: Record<string, unknown>,
  initialViewCtx?: ViewContext,
) => Promise<FastifyReply>;

// Always rendered on the server.
export type ReactView<P = {}> = VFC<P & { _ssr: true }>;
// Isomorphic, first-render happens on the server, then client revives it.
export type ReactIsland<P = {}> = VFC<P & { _csr?: boolean }>;
