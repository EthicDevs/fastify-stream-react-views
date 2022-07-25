import { FastifyReply } from "fastify";
import type { IncomingHttpHeaders } from "node:http";
import { VFC } from "react";

export type HtmlRelAttribute =
  | "alternate"
  | "author"
  | "bookmark"
  | "canonical"
  | "dns-prefetch"
  | "external"
  | "help"
  | "icon"
  | "license"
  | "manifest"
  | "me"
  | "modulepreload"
  | "next"
  | "nofollow"
  | "noopener"
  | "noreferrer"
  | "opener"
  | "pingback"
  | "preconnect"
  | "prefetch"
  | "preload"
  | "prerender"
  | "prev"
  | "search"
  | "stylesheet"
  | "tag";

export type ViewContext = {
  [x: string]: unknown;
  head?: HeadTag[];
  html?: {
    lang?: string;
    dir?: string;
  };
  scripts?: ScriptTag[];
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
   * External dependencies to NOT be bundled within the islands' bundle.
   * Those will instead needed to be placed in a .cdn folde in your PUBLIC_FOLDER
   * as umd modules so they can be cached by the browser once.
   * If not provided a sensible default will be used; see. DefaultExternalDependencies
   * Key is the ES/NPM dependency name, Value is the UMD Global export name for the module.
   **/
  externalDependencies?: Record<string, string>;
  /**
   * Path to React components to render as islands (w/ ext. jsx or tsx).
   *
   * Islands are regular components that get "revived" on the client once SSR
   * has been received by the client. It allows for self-contained area of
   * interactivity within a server-side rendered view, on the client side.
   *
   * @example path.resolve(path.join(__dirname, './islands'))
   */
  islandsFolder: string;
  /**
   * Root folder, folder before the source code where configuration files are.
   * Usually the project folder path.
   */
  rootFolder: string;
  /**
   * Dist/build folder, folder where built code is. Used the create the .islands
   * folder and files within it so they can be served to client easily.
   */
  distFolder: string;
  /**
   * Title bar separator character (`${pageTitle} ${titleSeparatorChar} ${appName}`)
   * defaults to: `-`, other cool values includes: `∙`
   **/
  titleSeparatorChar?: string;
  /**
   * Path to React components to render as views (w/ ext. jsx or tsx).
   * View are regular HTML pages made-up of server-side rendered React components.
   * @example path.resolve(path.join(__dirname, './views'))
   */
  viewsFolder: string;
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
  as?: string;
  crossorigin?: boolean;
  rel: HtmlRelAttribute;
  href: string;
  hreflang?: string;
  title?: string;
  type?: string;
};

export type HeadTag = HeadTagMeta | HeadTagMetaCharset | HeadTagLink;

export type ScriptTag =
  | {
      id?: string;
      async?: boolean;
      defer?: boolean;
      type: string;
      src: string;
      textContent?: undefined;
    }
  | {
      id?: string;
      async?: boolean;
      defer?: boolean;
      type: string;
      src?: undefined;
      textContent: string;
    };

export type StreamReactViewFunction = (
  this: FastifyReply,
  view: string,
  props?: Record<string, unknown>,
  initialViewCtx?: ViewContext,
) => Promise<FastifyReply>;

// Always rendered on the server.
export type ReactView<P = {}> = VFC<P & { _ssr: true }> & {
  viewId?: string;
  $type?: "ReactView";
};

// Isomorphic, first-render happens on the server, then client revives it.
export type ReactIsland<P = {}> = VFC<
  P & { _csr?: boolean; "data-islandid"?: string }
> & {
  islandId?: string;
  $type?: "ReactIsland";
};

export interface WrapperProps {
  islandId: string;
  childrenAsFn: (props: { "data-islandid": string }) => JSX.Element;
}
