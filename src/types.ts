import type { IncomingHttpHeaders } from "node:http";

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
  commonProps?: C;
}

export interface ViewContextBase {
  [x: string]: unknown;
  headers: IncomingHttpHeaders;
  status?: number;
  redirectUrl?: string;
}
