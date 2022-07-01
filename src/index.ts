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
  StreamReactViewFunction,
  StreamReactViewPluginOptions,
  ViewContext,
  ViewContextBase,
} from "./types";

/* Core functions */
export {
  bundleIslands,
  collectResources,
  generateManifest,
  makeIsland,
} from "./core";

/* Register function */
import { makePlugin } from "./pluginFactory";

/* Export the plugin */
export default makePlugin();
