import type { StreamReactViewFunction } from "./types";

declare module "fastify" {
  export interface FastifyReply {
    // A reply utility function that stream a React Component as the reply
    streamReactView: StreamReactViewFunction;
  }
}

/* Types */
export {
  CommonPropsBase,
  HeadTag,
  HeadTagLink,
  HeadTagMeta,
  HeadTagMetaCharset,
  ReactView,
  ReactIsland,
  ScriptTag,
  StreamReactViewFunction,
  StreamReactViewPluginOptions,
  ViewContext,
  ViewContextBase,
} from "./types";

/* Enums */
export { InternalViewKind } from "./enums/InternalViewKind";

/* Components */
export {
  DefaultInternalErrorView,
  DefaultNotFoundErrorView,
} from "./components";

/* Core functions */
export {
  bundleCode,
  bundleIslands,
  bundleRuntime,
  collectResources,
  generateManifest,
  makeIsland,
  makePageScript,
} from "./core";

/* Helpers functions */
export {
  buildViewWithProps,
  endStreamWithHtmlError,
  isStyledComponentsAvailable,
  walkFolderForFiles,
  wrapComponent,
  removeCommentsAndSpacing,
} from "./helpers";

/* Register function */
import { makePlugin } from "./pluginFactory";

/* Export the plugin */
export default makePlugin();
